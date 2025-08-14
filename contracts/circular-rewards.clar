;; Circular Rewards Contract
;; Clarity v2
;; Manages token rewards for sustainable actions in ThreadCycle

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-AMOUNT u106)
(define-constant ERR-INVALID-EVENT u107)
(define-constant ERR-MAX-SUPPLY-REACHED u108)
(define-constant ERR-COOLDOWN-ACTIVE u109)
(define-constant ERR-PROVENANCE-NOT-SET u110)

;; Token metadata
(define-constant TOKEN-NAME "ThreadCycle Eco Token")
(define-constant TOKEN-SYMBOL "TCET")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000) ;; 1B tokens (decimals accounted separately)

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-supply uint u0)
(define-data-var provenance-contract (optional principal) none)

;; Reward configuration
(define-data-var reward-per-action uint u1000000) ;; 1 TCET per action
(define-data-var cooldown-period uint u1440) ;; ~1 day in blocks (assuming 10min/block)

;; Balances and action tracking
(define-map balances principal uint)
(define-map last-action-timestamp principal uint)
(define-map action-count principal uint)

;; Valid action types
(define-constant VALID-ACTIONS (list "recycle" "resale" "donation" "repair"))

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate action type
(define-private (is-valid-action (action-type (string-ascii 32)))
  (is-some (index-of VALID-ACTIONS action-type))
)

;; Private helper: check cooldown
(define-private (is-cooldown-expired (user principal))
  (let ((last-action (default-to u0 (map-get? last-action-timestamp user))))
    (>= (- block-height last-action) (var-get cooldown-period))
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Set provenance contract address
(define-public (set-provenance-contract (contract-principal principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract-principal 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (var-set provenance-contract (some contract-principal))
    (ok true)
  )
)

;; Update reward amount per action (admin only)
(define-public (set-reward-per-action (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (var-set reward-per-action amount)
    (ok true)
  )
)

;; Update cooldown period (admin only)
(define-public (set-cooldown-period (blocks uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (> blocks u0) (err ERR-INVALID-AMOUNT))
    (var-set cooldown-period blocks)
    (ok true)
  )
)

;; Mint tokens (admin only, for initial distribution or emergencies)
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((new-supply (+ (var-get total-supply) amount)))
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (var-set total-supply new-supply)
      (ok true)
    )
  )
)

;; Transfer tokens
(define-public (transfer (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((sender-balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (ok true)
    )
  )
)

;; Reward sustainable action (called by Provenance Tracking Contract)
(define-public (reward-action (user principal) (action-type (string-ascii 32)))
  (begin
    (asserts! (is-some (var-get provenance-contract)) (err ERR-PROVENANCE-NOT-SET))
    (asserts! (is-eq tx-sender (unwrap! (var-get provenance-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-action action-type) (err ERR-INVALID-EVENT))
    (asserts! (is-cooldown-expired user) (err ERR-COOLDOWN-ACTIVE))
    (ensure-not-paused)
    (let ((reward-amount (var-get reward-per-action))
          (new-supply (+ (var-get total-supply) reward-amount)))
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances user (+ reward-amount (default-to u0 (map-get? balances user))))
      (map-set last-action-timestamp user block-height)
      (map-set action-count user (+ u1 (default-to u0 (map-get? action-count user))))
      (var-set total-supply new-supply)
      (ok reward-amount)
    )
  )
)

;; Burn tokens
(define-public (burn (amount uint))
  (begin
    (ensure-not-paused)
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (var-set total-supply (- (var-get total-supply) amount))
      (ok true)
    )
  )
)

;; Read-only: get balance
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

;; Read-only: get total supply
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get reward per action
(define-read-only (get-reward-per-action)
  (ok (var-get reward-per-action))
)

;; Read-only: get cooldown period
(define-read-only (get-cooldown-period)
  (ok (var-get cooldown-period))
)

;; Read-only: get action count
(define-read-only (get-action-count (user principal))
  (ok (default-to u0 (map-get? action-count user)))
)

;; Read-only: get last action timestamp
(define-read-only (get-last-action-timestamp (user principal))
  (ok (default-to u0 (map-get? last-action-timestamp user)))
)

;; Read-only: get provenance contract
(define-read-only (get-provenance-contract)
  (ok (var-get provenance-contract))
)