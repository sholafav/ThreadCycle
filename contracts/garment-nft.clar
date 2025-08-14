;; Garment NFT Contract
;; Clarity v2
;; Manages NFT minting, metadata storage, and lifecycle updates for ThreadCycle garments

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-ID u101)
(define-constant ERR-ALREADY-MINTED u102)
(define-constant ERR-NOT-OWNER u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-METADATA u106)
(define-constant ERR-NO-NFT u107)
(define-constant ERR-INVALID-EVENT u108)

;; Contract metadata
(define-constant CONTRACT-NAME "ThreadCycle Garment NFT")
(define-constant CONTRACT-SYMBOL "TC-NFT")
(define-constant MAX-NFTS u1000000) ;; Max 1M NFTs

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-nfts uint u0)
(define-data-var provenance-contract (optional principal) none)

;; NFT data structures
(define-map nfts uint { owner: principal, metadata: (string-utf8 256) })
(define-map lifecycle-events uint (list 50 { event-type: (string-ascii 32), timestamp: uint, details: (string-utf8 256) }))
(define-map token-count principal uint)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: validate metadata
(define-private (is-valid-metadata (metadata (string-utf8 256)))
  (and (> (len metadata) u0) (<= (len metadata) u256))
)

;; Private helper: validate event type
(define-private (is-valid-event-type (event-type (string-ascii 32)))
  (or
    (is-eq event-type "production")
    (is-eq event-type "repair")
    (is-eq event-type "resale")
    (is-eq event-type "recycle")
    (is-eq event-type "donation"))
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

;; Mint a new garment NFT
(define-public (mint (recipient principal) (metadata (string-utf8 256)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (asserts! (is-valid-metadata metadata) (err ERR-INVALID-METADATA))
    (ensure-not-paused)
    (let ((token-id (+ (var-get total-nfts) u1)))
      (asserts! (<= token-id MAX-NFTS) (err ERR-ALREADY-MINTED))
      (map-set nfts token-id { owner: recipient, metadata: metadata })
      (map-set token-count recipient (+ u1 (default-to u0 (map-get? token-count recipient))))
      (var-set total-nfts token-id)
      (ok token-id)
    )
  )
)

;; Transfer NFT
(define-public (transfer (token-id uint) (recipient principal))
  (begin
    (ensure-not-paused)
    (asserts! (not (is-eq recipient 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
    (match (map-get? nfts token-id)
      nft
      (begin
        (asserts! (is-eq tx-sender (get owner nft)) (err ERR-NOT-OWNER))
        (map-set nfts token-id { owner: recipient, metadata: (get metadata nft) })
        (map-set token-count tx-sender (- (default-to u0 (map-get? token-count tx-sender)) u1))
        (map-set token-count recipient (+ u1 (default-to u0 (map-get? token-count recipient))))
        (ok true)
      )
      (err ERR-NO-NFT)
    )
  )
)

;; Update NFT metadata (admin only)
(define-public (update-metadata (token-id uint) (new-metadata (string-utf8 256)))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-metadata new-metadata) (err ERR-INVALID-METADATA))
    (match (map-get? nfts token-id)
      nft
      (begin
        (map-set nfts token-id { owner: (get owner nft), metadata: new-metadata })
        (ok true)
      )
      (err ERR-NO-NFT)
    )
  )
)

;; Add lifecycle event (called by Provenance Tracking Contract)
(define-public (add-lifecycle-event (token-id uint) (event-type (string-ascii 32)) (details (string-utf8 256)))
  (begin
    (asserts! (is-some (var-get provenance-contract)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq tx-sender (unwrap! (var-get provenance-contract) (err ERR-NOT-AUTHORIZED))) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-valid-event-type event-type) (err ERR-INVALID-EVENT))
    (asserts! (is-valid-metadata details) (err ERR-INVALID-METADATA))
    (match (map-get? nfts token-id)
      nft
      (let ((current-events (default-to (list) (map-get? lifecycle-events token-id))))
        (asserts! (< (len current-events) u50) (err ERR-INVALID-EVENT))
        (map-set lifecycle-events token-id
          (unwrap! (as-max-len? (append current-events { event-type: event-type, timestamp: block-height, details: details }) u50)
            (err ERR-INVALID-EVENT)))
        (ok true)
      )
      (err ERR-NO-NFT)
    )
  )
)

;; Burn NFT (admin only)
(define-public (burn (token-id uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (match (map-get? nfts token-id)
      nft
      (begin
        (map-set token-count (get owner nft) (- (default-to u0 (map-get? token-count (get owner nft))) u1))
        (map-delete nfts token-id)
        (map-delete lifecycle-events token-id)
        (ok true)
      )
      (err ERR-NO-NFT)
    )
  )
)

;; Read-only: get NFT owner
(define-read-only (get-owner (token-id uint))
  (match (map-get? nfts token-id)
    nft (ok (get owner nft))
    (err ERR-NO-NFT)
  )
)

;; Read-only: get NFT metadata
(define-read-only (get-metadata (token-id uint))
  (match (map-get? nfts token-id)
    nft (ok (get metadata nft))
    (err ERR-NO-NFT)
  )
)

;; Read-only: get lifecycle events
(define-read-only (get-lifecycle-events (token-id uint))
  (ok (default-to (list) (map-get? lifecycle-events token-id)))
)

;; Read-only: get total NFTs
(define-read-only (get-total-nfts)
  (ok (var-get total-nfts))
)

;; Read-only: get token count for address
(define-read-only (get-token-count (account principal))
  (ok (default-to u0 (map-get? token-count account)))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Read-only: get provenance contract
(define-read-only (get-provenance-contract)
  (ok (var-get provenance-contract))
)