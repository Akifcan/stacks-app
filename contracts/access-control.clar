;; Essential Smart Contract Patterns - Access Control
;;
;; This contract implements role-based access control with admin and user roles.
;; It provides a foundational access control system that other contracts can use.

;; Define constants for error codes
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-ALREADY-ADMIN (err u101))
(define-constant ERR-NOT-ADMIN (err u102))
(define-constant ERR-CANNOT-REMOVE-LAST-ADMIN (err u103))
(define-constant ERR-INVALID-PRINCIPAL (err u104))

;; Define constants for roles
(define-constant ADMIN-ROLE u1)
(define-constant USER-ROLE u2)

;; Contract deployer is the initial admin
(define-data-var contract-owner principal tx-sender)

;; Map to store admin addresses
(define-map admins principal bool)

;; Map to store user roles (can be extended for more granular permissions)
(define-map user-roles principal uint)

;; Initialize contract by setting deployer as admin
(map-set admins tx-sender true)
(map-set user-roles tx-sender ADMIN-ROLE)

;; PRIVATE FUNCTIONS

;; Check if an address is an admin
(define-private (is-admin (user principal))
  (default-to false (map-get? admins user)))

;; Count total number of admins
(define-private (count-admins)
  (fold count-admin-fold (list tx-sender) u0))

(define-private (count-admin-fold (user principal) (count uint))
  (if (is-admin user)
    (+ count u1)
    count))

;; READ-ONLY FUNCTIONS

;; Get contract owner
(define-read-only (get-contract-owner)
  (var-get contract-owner))

;; Check if a user has admin role
(define-read-only (has-admin-role (user principal))
  (is-admin user))

;; Check if a user has any role
(define-read-only (has-role (user principal))
  (is-some (map-get? user-roles user)))

;; Get user role
(define-read-only (get-user-role (user principal))
  (map-get? user-roles user))

;; Check if caller is authorized (has any role)
(define-read-only (is-authorized (user principal))
  (or (is-admin user)
      (is-some (map-get? user-roles user))))

;; PUBLIC FUNCTIONS

;; Add a new admin (only existing admin can call)
(define-public (add-admin (new-admin principal))
  (begin
    ;; Check if caller is admin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    ;; Check if new-admin is valid
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) ERR-INVALID-PRINCIPAL)
    ;; Check if already admin
    (asserts! (not (is-admin new-admin)) ERR-ALREADY-ADMIN)
    ;; Add admin
    (map-set admins new-admin true)
    (map-set user-roles new-admin ADMIN-ROLE)
    (ok true)))

;; Remove admin (only existing admin can call, cannot remove last admin)
(define-public (remove-admin (admin-to-remove principal))
  (begin
    ;; Check if caller is admin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    ;; Check if target is admin
    (asserts! (is-admin admin-to-remove) ERR-NOT-ADMIN)
    ;; Prevent removing the last admin (simplified check)
    (asserts! (not (is-eq tx-sender admin-to-remove)) ERR-CANNOT-REMOVE-LAST-ADMIN)
    ;; Remove admin
    (map-delete admins admin-to-remove)
    (map-delete user-roles admin-to-remove)
    (ok true)))

;; Grant user role (only admin can call)
(define-public (grant-user-role (user principal))
  (begin
    ;; Check if caller is admin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    ;; Check if user is valid
    (asserts! (not (is-eq user 'SP000000000000000000002Q6VF78)) ERR-INVALID-PRINCIPAL)
    ;; Grant user role
    (map-set user-roles user USER-ROLE)
    (ok true)))

;; Revoke user role (only admin can call)
(define-public (revoke-user-role (user principal))
  (begin
    ;; Check if caller is admin
    (asserts! (is-admin tx-sender) ERR-UNAUTHORIZED)
    ;; Don't revoke admin roles through this function
    (asserts! (not (is-admin user)) ERR-UNAUTHORIZED)
    ;; Revoke user role
    (map-delete user-roles user)
    (ok true)))

;; Renounce own role (any user can renounce their own role)
(define-public (renounce-role)
  (begin
    ;; Check if user has a role
    (asserts! (is-some (map-get? user-roles tx-sender)) ERR-UNAUTHORIZED)
    ;; Prevent last admin from renouncing
    (asserts! (not (is-admin tx-sender)) ERR-CANNOT-REMOVE-LAST-ADMIN)
    ;; Remove role
    (map-delete user-roles tx-sender)
    (if (is-admin tx-sender)
      (map-delete admins tx-sender)
      true)
    (ok true)))

;; Transfer contract ownership (only current owner can call)
(define-public (transfer-ownership (new-owner principal))
  (begin
    ;; Check if caller is current owner
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-UNAUTHORIZED)
    ;; Check if new owner is valid
    (asserts! (not (is-eq new-owner 'SP000000000000000000002Q6VF78)) ERR-INVALID-PRINCIPAL)
    ;; Make new owner an admin if not already
    (if (not (is-admin new-owner))
      (begin
        (map-set admins new-owner true)
        (map-set user-roles new-owner ADMIN-ROLE))
      true)
    ;; Transfer ownership
    (var-set contract-owner new-owner)
    (ok true)))