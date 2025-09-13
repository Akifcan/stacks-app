;; Essential Smart Contract Patterns - Message Board
;;
;; This contract implements a message board for storing and retrieving messages
;; with timestamp tracking and permission controls.

;; Define constants for error codes
(define-constant ERR-UNAUTHORIZED (err u400))
(define-constant ERR-MESSAGE-NOT-FOUND (err u401))
(define-constant ERR-MESSAGE-TOO-LONG (err u402))
(define-constant ERR-EMPTY-MESSAGE (err u403))
(define-constant ERR-INVALID-MESSAGE-ID (err u404))
(define-constant ERR-MESSAGE-ALREADY-DELETED (err u405))
(define-constant ERR-BOARD-PAUSED (err u406))
(define-constant ERR-TOO-MANY-MESSAGES (err u407))

;; Define constants for message limits
(define-constant MAX-MESSAGE-LENGTH u500)
(define-constant MAX-MESSAGES-PER-USER u100)
(define-constant MAX-TOTAL-MESSAGES u10000)

;; Message data structure
(define-map messages uint {
  content: (string-utf8 500),
  author: principal,
  timestamp: uint,
  block-height: uint,
  deleted: bool,
  reply-to: (optional uint)
})

;; Track messages by author
(define-map user-messages principal (list 100 uint))

;; Track message counter
(define-data-var message-counter uint u0)

;; Track total active messages
(define-data-var active-message-count uint u0)

;; Board configuration
(define-data-var board-paused bool false)
(define-data-var moderation-enabled bool true)
(define-data-var public-posting-allowed bool false)

;; Featured/pinned messages (admin curated)
(define-data-var pinned-messages (list 10 uint) (list))

;; PRIVATE FUNCTIONS

;; Check if caller has admin role
(define-private (is-admin (user principal))
  (contract-call? .access-control has-admin-role user))

;; Check if caller is authorized
(define-private (is-authorized (user principal))
  (contract-call? .access-control is-authorized user))

;; Check if message exists and is not deleted
(define-private (message-exists (message-id uint))
  (match (map-get? messages message-id)
    message (not (get deleted message))
    false))

;; Get user message count
(define-private (get-user-message-count (user principal))
  (len (default-to (list) (map-get? user-messages user))))

;; Add message to user's message list
(define-private (add-message-to-user (user principal) (message-id uint))
  (let ((current-messages (default-to (list) (map-get? user-messages user))))
    (map-set user-messages user
      (unwrap! (as-max-len? (append current-messages message-id) u100)
               current-messages))))

;; Remove message from user's message list
(define-private (remove-message-from-user (user principal) (message-id uint))
  (let ((current-messages (default-to (list) (map-get? user-messages user))))
    (map-set user-messages user
      (filter is-not-message-id current-messages))))

;; Helper for filtering messages
(define-private (is-not-message-id (id uint))
  (not (is-eq id message-id)))

;; Validate message content
(define-private (validate-message-content (content (string-utf8 500)))
  (and
    (> (len content) u0)
    (<= (len content) MAX-MESSAGE-LENGTH)))

;; READ-ONLY FUNCTIONS

;; Get message by ID
(define-read-only (get-message (message-id uint))
  (map-get? messages message-id))

;; Get message content only (for quick access)
(define-read-only (get-message-content (message-id uint))
  (match (map-get? messages message-id)
    message (if (get deleted message)
               none
               (some (get content message)))
    none))

;; Get messages by author
(define-read-only (get-user-messages (user principal))
  (map-get? user-messages user))

;; Get recent messages (last N messages)
(define-read-only (get-recent-messages (count uint))
  (let ((total-messages (var-get message-counter))
        (start-id (if (> total-messages count) (- total-messages count) u1)))
    (map get-message-if-exists (generate-sequence start-id total-messages))))

;; Helper for getting messages in sequence
(define-private (generate-sequence (start uint) (end uint))
  (if (<= start end)
    (list start)
    (list)))

(define-private (get-message-if-exists (message-id uint))
  (map-get? messages message-id))

;; Get board statistics
(define-read-only (get-board-stats)
  {
    total-messages: (var-get message-counter),
    active-messages: (var-get active-message-count),
    is-paused: (var-get board-paused),
    moderation-enabled: (var-get moderation-enabled),
    public-posting-allowed: (var-get public-posting-allowed)
  })

;; Get pinned messages
(define-read-only (get-pinned-messages)
  (var-get pinned-messages))

;; Search messages by author (returns message IDs)
(define-read-only (get-messages-by-author (author principal))
  (default-to (list) (map-get? user-messages author)))

;; PUBLIC FUNCTIONS

;; Post a new message
(define-public (post-message (content (string-utf8 500)) (reply-to (optional uint)))
  (let ((message-id (+ (var-get message-counter) u1)))
    (begin
      ;; Check if board is paused
      (asserts! (not (var-get board-paused)) ERR-BOARD-PAUSED)

      ;; Check authorization (public posting or authorized user)
      (if (var-get public-posting-allowed)
        true
        (asserts! (unwrap! (is-authorized tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED))

      ;; Validate message content
      (asserts! (validate-message-content content) ERR-MESSAGE-TOO-LONG)

      ;; Check user message limit
      (asserts! (< (get-user-message-count tx-sender) MAX-MESSAGES-PER-USER) ERR-TOO-MANY-MESSAGES)

      ;; Check total message limit
      (asserts! (< (var-get message-counter) MAX-TOTAL-MESSAGES) ERR-TOO-MANY-MESSAGES)

      ;; Validate reply-to if provided
      (match reply-to
        parent-id (asserts! (message-exists parent-id) ERR-MESSAGE-NOT-FOUND)
        true)

      ;; Create message
      (map-set messages message-id {
        content: content,
        author: tx-sender,
        timestamp: (unwrap! (get-stacks-block-info? time (- block-height u1)) u0),
        block-height: block-height,
        deleted: false,
        reply-to: reply-to
      })

      ;; Update counters
      (var-set message-counter message-id)
      (var-set active-message-count (+ (var-get active-message-count) u1))

      ;; Add to user messages
      (add-message-to-user tx-sender message-id)

      (ok message-id))))

;; Edit a message (author only)
(define-public (edit-message (message-id uint) (new-content (string-utf8 500)))
  (let ((message (unwrap! (map-get? messages message-id) ERR-MESSAGE-NOT-FOUND)))
    (begin
      ;; Check if message exists and not deleted
      (asserts! (not (get deleted message)) ERR-MESSAGE-ALREADY-DELETED)

      ;; Check if caller is author or admin
      (asserts! (or (is-eq tx-sender (get author message))
                    (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED))
                ERR-UNAUTHORIZED)

      ;; Validate new content
      (asserts! (validate-message-content new-content) ERR-MESSAGE-TOO-LONG)

      ;; Update message
      (map-set messages message-id (merge message {content: new-content}))

      (ok true))))

;; Delete a message (author or admin)
(define-public (delete-message (message-id uint))
  (let ((message (unwrap! (map-get? messages message-id) ERR-MESSAGE-NOT-FOUND)))
    (begin
      ;; Check if message exists and not already deleted
      (asserts! (not (get deleted message)) ERR-MESSAGE-ALREADY-DELETED)

      ;; Check if caller is author or admin
      (asserts! (or (is-eq tx-sender (get author message))
                    (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED))
                ERR-UNAUTHORIZED)

      ;; Mark as deleted
      (map-set messages message-id (merge message {deleted: true}))

      ;; Update active message count
      (var-set active-message-count (- (var-get active-message-count) u1))

      (ok true))))

;; Pin a message (admin only)
(define-public (pin-message (message-id uint))
  (let ((current-pinned (var-get pinned-messages)))
    (begin
      ;; Check admin authorization
      (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)

      ;; Check if message exists
      (asserts! (message-exists message-id) ERR-MESSAGE-NOT-FOUND)

      ;; Add to pinned messages if not already pinned
      (if (is-none (index-of current-pinned message-id))
        (var-set pinned-messages
          (unwrap! (as-max-len? (append current-pinned message-id) u10)
                   current-pinned))
        true)

      (ok true))))

;; Unpin a message (admin only)
(define-public (unpin-message (message-id uint))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)

    ;; Remove from pinned messages
    (var-set pinned-messages
      (filter not-message-id (var-get pinned-messages)))

    (ok true)))

;; Helper for unpinning
(define-private (not-message-id (id uint))
  (not (is-eq id message-id)))

;; Configure board settings (admin only)
(define-public (configure-board (paused bool) (moderation bool) (public-posting bool))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)

    ;; Update settings
    (var-set board-paused paused)
    (var-set moderation-enabled moderation)
    (var-set public-posting-allowed public-posting)

    (ok true)))

;; Emergency pause (admin only)
(define-public (emergency-pause)
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)

    ;; Pause board
    (var-set board-paused true)

    (ok true)))