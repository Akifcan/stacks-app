;; Essential Smart Contract Patterns - Simple Voting System
;;
;; This contract implements a basic yes/no voting system with proposal creation
;; and vote counting. It integrates with the access control contract for permissions.

;; Import access control contract (trait would be better for production)
(use-trait access-control-trait .access-control)

;; Define constants for error codes
(define-constant ERR-UNAUTHORIZED (err u200))
(define-constant ERR-PROPOSAL-NOT-FOUND (err u201))
(define-constant ERR-PROPOSAL-ENDED (err u202))
(define-constant ERR-ALREADY-VOTED (err u203))
(define-constant ERR-INVALID-VOTE (err u204))
(define-constant ERR-PROPOSAL-ACTIVE (err u205))
(define-constant ERR-INVALID-DURATION (err u206))

;; Define constants for vote types
(define-constant VOTE-YES u1)
(define-constant VOTE-NO u2)

;; Define proposal status constants
(define-constant STATUS-ACTIVE u1)
(define-constant STATUS-PASSED u2)
(define-constant STATUS-FAILED u3)

;; Data structure for proposals
(define-map proposals uint {
  title: (string-ascii 100),
  description: (string-ascii 500),
  proposer: principal,
  start-block: uint,
  end-block: uint,
  yes-votes: uint,
  no-votes: uint,
  status: uint
})

;; Track votes by proposal and voter
(define-map votes {proposal-id: uint, voter: principal} uint)

;; Track proposal counter
(define-data-var proposal-counter uint u0)

;; Minimum voting duration in blocks (1 day ≈ 144 blocks)
(define-data-var min-voting-duration uint u144)

;; Maximum voting duration in blocks (30 days ≈ 4320 blocks)
(define-data-var max-voting-duration uint u4320)

;; PRIVATE FUNCTIONS

;; Check if caller has admin role in access control contract
(define-private (is-admin (user principal))
  (contract-call? .access-control has-admin-role user))

;; Check if caller is authorized (has any role)
(define-private (is-authorized (user principal))
  (contract-call? .access-control is-authorized user))

;; Calculate if proposal has passed
(define-private (has-proposal-passed (yes-votes uint) (no-votes uint))
  (> yes-votes no-votes))

;; Get current block height
(define-private (current-block-height)
  block-height)

;; READ-ONLY FUNCTIONS

;; Get proposal details
(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id))

;; Get vote for a specific voter on a proposal
(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes {proposal-id: proposal-id, voter: voter}))

;; Check if proposal is active
(define-read-only (is-proposal-active (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal (and
      (>= (current-block-height) (get start-block proposal))
      (<= (current-block-height) (get end-block proposal))
      (is-eq (get status proposal) STATUS-ACTIVE))
    false))

;; Get total number of proposals
(define-read-only (get-proposal-count)
  (var-get proposal-counter))

;; Get voting configuration
(define-read-only (get-voting-config)
  {
    min-duration: (var-get min-voting-duration),
    max-duration: (var-get max-voting-duration)
  })

;; Get proposal results
(define-read-only (get-proposal-results (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal {
      yes-votes: (get yes-votes proposal),
      no-votes: (get no-votes proposal),
      total-votes: (+ (get yes-votes proposal) (get no-votes proposal)),
      status: (get status proposal),
      passed: (has-proposal-passed (get yes-votes proposal) (get no-votes proposal))
    }
    none))

;; PUBLIC FUNCTIONS

;; Create a new proposal (only authorized users can create)
(define-public (create-proposal
  (title (string-ascii 100))
  (description (string-ascii 500))
  (duration-blocks uint))
  (let ((proposal-id (+ (var-get proposal-counter) u1))
        (start-block (current-block-height))
        (end-block (+ (current-block-height) duration-blocks)))
    (begin
      ;; Check authorization
      (asserts! (unwrap! (is-authorized tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
      ;; Validate duration
      (asserts! (>= duration-blocks (var-get min-voting-duration)) ERR-INVALID-DURATION)
      (asserts! (<= duration-blocks (var-get max-voting-duration)) ERR-INVALID-DURATION)
      ;; Create proposal
      (map-set proposals proposal-id {
        title: title,
        description: description,
        proposer: tx-sender,
        start-block: start-block,
        end-block: end-block,
        yes-votes: u0,
        no-votes: u0,
        status: STATUS-ACTIVE
      })
      ;; Update counter
      (var-set proposal-counter proposal-id)
      (ok proposal-id))))

;; Cast a vote on a proposal
(define-public (vote (proposal-id uint) (vote-type uint))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
    (begin
      ;; Check authorization
      (asserts! (unwrap! (is-authorized tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
      ;; Check if proposal is active
      (asserts! (is-proposal-active proposal-id) ERR-PROPOSAL-ENDED)
      ;; Check if already voted
      (asserts! (is-none (map-get? votes {proposal-id: proposal-id, voter: tx-sender})) ERR-ALREADY-VOTED)
      ;; Validate vote type
      (asserts! (or (is-eq vote-type VOTE-YES) (is-eq vote-type VOTE-NO)) ERR-INVALID-VOTE)
      ;; Record vote
      (map-set votes {proposal-id: proposal-id, voter: tx-sender} vote-type)
      ;; Update proposal vote counts
      (if (is-eq vote-type VOTE-YES)
        (map-set proposals proposal-id (merge proposal {yes-votes: (+ (get yes-votes proposal) u1)}))
        (map-set proposals proposal-id (merge proposal {no-votes: (+ (get no-votes proposal) u1)})))
      (ok true))))

;; Finalize a proposal (can be called by anyone after voting period ends)
(define-public (finalize-proposal (proposal-id uint))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
    (begin
      ;; Check if voting period has ended
      (asserts! (> (current-block-height) (get end-block proposal)) ERR-PROPOSAL-ACTIVE)
      ;; Check if proposal is still active
      (asserts! (is-eq (get status proposal) STATUS-ACTIVE) ERR-PROPOSAL-ENDED)
      ;; Determine final status
      (let ((final-status (if (has-proposal-passed (get yes-votes proposal) (get no-votes proposal))
                            STATUS-PASSED
                            STATUS-FAILED)))
        ;; Update proposal status
        (map-set proposals proposal-id (merge proposal {status: final-status}))
        (ok final-status)))))

;; Admin function to update voting duration limits
(define-public (update-voting-duration (min-duration uint) (max-duration uint))
  (begin
    ;; Check admin authorization
    (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
    ;; Validate parameters
    (asserts! (> max-duration min-duration) ERR-INVALID-DURATION)
    (asserts! (> min-duration u0) ERR-INVALID-DURATION)
    ;; Update durations
    (var-set min-voting-duration min-duration)
    (var-set max-voting-duration max-duration)
    (ok true)))

;; Admin function to cancel a proposal (emergency use)
(define-public (cancel-proposal (proposal-id uint))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-PROPOSAL-NOT-FOUND)))
    (begin
      ;; Check admin authorization
      (asserts! (unwrap! (is-admin tx-sender) ERR-UNAUTHORIZED) ERR-UNAUTHORIZED)
      ;; Check if proposal is active
      (asserts! (is-eq (get status proposal) STATUS-ACTIVE) ERR-PROPOSAL-ENDED)
      ;; Cancel proposal
      (map-set proposals proposal-id (merge proposal {status: STATUS-FAILED}))
      (ok true))))