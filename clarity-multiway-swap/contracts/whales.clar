
;; whales
(define-non-fungible-token whales uint)

;; constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

;; data maps and vars
(define-data-var last-token-id uint u0)


;; private functions
;;

;; public functions
(define-read-only (get-last-token-id)
    (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
    (ok none)
)

(define-read-only (get-owner (token-id uint))
    (ok (nft-get-owner? whales token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender sender) err-not-token-owner)
        (nft-transfer? whales token-id sender recipient)
    )
)

(define-public (mint (recipient principal))
    (let
        (
            (token-id (+ (var-get last-token-id) u1))
        )
        (asserts! (is-eq tx-sender contract-owner) err-owner-only)
        (try! (nft-mint? whales token-id recipient))
        (var-set last-token-id token-id)
        (ok token-id)
    )
)


(nft-mint? whales u1 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(nft-mint? whales u2 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(nft-mint? whales u3 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(nft-mint? whales u4 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC)
(var-set last-token-id u4)