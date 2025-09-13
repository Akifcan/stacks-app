;; Essential Smart Contract Patterns - Counter Contract
;;
;; This contract implements a simple counter with increment/decrement functionality
;; and permission controls using the access control contract.

;; Define constants for error codes
(define-constant ERR-UNAUTHORIZED (err u300))
(define-constant ERR-COUNTER-OVERFLOW (err u301))
(define-constant ERR-COUNTER-UNDERFLOW (err u302))
(define-constant ERR-INVALID-AMOUNT (err u303))
(define-constant ERR-COUNTER-PAUSED (err u304))

;; Define maximum counter value to prevent overflow
(define-constant MAX-COUNTER-VALUE u1000000000)

;; Counter state
(define-data-var counter uint u0)

;; Track who can increment/decrement
(define-data-var increment-permission-required bool true)
(define-data-var decrement-permission-required bool true)

;; Emergency pause functionality
(define-data-var contract-paused bool false)

;; Track counter history for events
(define-data-var counter-history (list 100 {block: uint, value: uint, action: (string-ascii 10), actor: principal}) (list))

;; PRIVATE FUNCTIONS

;; Check if caller has admin role
(define-private (is-admin (user principal))
  (contract-call? .access-control has-admin-role user))

;; Check if caller is authorized
(define-private (is-authorized (user principal))
  (contract-call? .access-control is-authorized user))

;; Add entry to counter history
(define-private (add-to-history (action (string-ascii 10)) (new-value uint))
  (let ((current-history (var-get counter-history))
        (new-entry {block: block-height, value: new-value, action: action, actor: tx-sender}))
    (var-set counter-history
      (unwrap! (as-max-len? (append current-history new-entry) u100)
               current-history))))

;; Check if contract is paused
(define-private (is-paused)
  (var-get contract-paused))

;; READ-ONLY FUNCTIONS

;; Get current counter value
(define-read-only (get-counter)
  (var-get counter))

;; Get counter configuration
(define-read-only (get-counter-config)
  {
    current-value: (var-get counter),
    increment-permission-required: (var-get increment-permission-required),
    decrement-permission-required: (var-get decrement-permission-required),
    is-paused: (var-get contract-paused),
    max-value: MAX-COUNTER-VALUE
  })

;; Get counter history
(define-read-only (get-counter-history)
  (var-get counter-history))

;; Get latest counter actions (last 10)
(define-read-only (get-recent-history)
  (let ((history (var-get counter-history))
        (history-len (len history)))
    (if (>= history-len u10)
      (unwrap! (slice? history (- history-len u10) history-len) (list))
      history)))

;; Check if user can increment
(define-read-only (can-increment (user principal))
  (if (var-get increment-permission-required)
    (unwrap-panic (is-authorized user))
    true))

;; Check if user can decrement
(define-read-only (can-decrement (user principal))
  (if (var-get decrement-permission-required)
    (unwrap-panic (is-authorized user))
    true))

;; PUBLIC FUNCTIONS

;; Increment counter by 1
(define-public (increment)
  (increment-by u1))

;; Increment counter by specified amount
(define-public (increment-by (amount uint))
  (let ((current-value (var-get counter)))
    (begin
      ;; Check if contract is paused
      (asserts! (not (is-paused)) ERR-COUNTER-PAUSED)
      ;; Check authorization if required
      (if (var-get increment-permission-required)
        (asserts! (unwrap! (is-authorized tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
        true)
      ;; Validate amount
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      ;; Check for overflow
      (asserts! (<= (+ current-value amount) MAX-COUNTER-VALUE) ERR-COUNTER-OVERFLOW)
      ;; Update counter
      (let ((new-value (+ current-value amount)))
        (var-set counter new-value)
        ;; Add to history
        (add-to-history "increment" new-value)
        (ok new-value)))))

;; Decrement counter by 1
(define-public (decrement)
  (decrement-by u1))

;; Decrement counter by specified amount
(define-public (decrement-by (amount uint))
  (let ((current-value (var-get counter)))
    (begin
      ;; Check if contract is paused
      (asserts! (not (is-paused)) ERR-COUNTER-PAUSED)
      ;; Check authorization if required
      (if (var-get decrement-permission-required)
        (asserts! (unwrap! (is-authorized tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
        true)
      ;; Validate amount
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      ;; Check for underflow
      (asserts! (>= current-value amount) ERR-COUNTER-UNDERFLOW)
      ;; Update counter
      (let ((new-value (- current-value amount)))
        (var-set counter new-value)
        ;; Add to history
        (add-to-history "decrement" new-value)
        (ok new-value)))))

;; Reset counter to zero (admin only)
(define-public (reset-counter)
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Reset counter
    (var-set counter u0)
    ;; Add to history
    (add-to-history "reset" u0)
    (ok u0)))

;; Set counter to specific value (admin only)
(define-public (set-counter (new-value uint))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Check if contract is paused
    (asserts! (not (is-paused)) ERR-COUNTER-PAUSED)
    ;; Validate new value
    (asserts! (<= new-value MAX-COUNTER-VALUE) ERR-COUNTER-OVERFLOW)
    ;; Set counter
    (var-set counter new-value)
    ;; Add to history
    (add-to-history "set" new-value)
    (ok new-value)))

;; Configure permission requirements (admin only)
(define-public (set-permission-requirements (increment-req bool) (decrement-req bool))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Update permissions
    (var-set increment-permission-required increment-req)
    (var-set decrement-permission-required decrement-req)
    (ok true)))

;; Pause/unpause contract (admin only)
(define-public (set-contract-paused (paused bool))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Update pause state
    (var-set contract-paused paused)
    ;; Add to history
    (add-to-history (if paused "pause" "unpause") (var-get counter))
    (ok paused)))

;; Emergency pause (admin only)
(define-public (emergency-pause)
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Pause contract
    (var-set contract-paused true)
    ;; Add to history
    (add-to-history "emergency" (var-get counter))
    (ok true)))

;; Batch operations for efficiency (admin only)
(define-public (batch-increment (times uint))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Check if contract is paused
    (asserts! (not (is-paused)) ERR-COUNTER-PAUSED)
    ;; Validate times
    (asserts! (and (> times u0) (<= times u100)) ERR-INVALID-AMOUNT)
    ;; Increment by batch amount
    (increment-by times)))