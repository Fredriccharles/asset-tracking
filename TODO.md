# TODO: Role-based access + Available assets dashboard

## Backend
- [x] 1. schema.sql: allow role 'user' in users CHECK constraint
- [x] 2. init.js: migration to rebuild users table for existing DBs with 'user' role
- [x] 3. middleware/auth.js: add requireAdmin middleware
- [x] 4. routes: apply requireAdmin to write/admin operations
- [x] 5. dashboardController: add availableByCategory + availableAssets to summary

## Frontend
- [x] 6. api.js: add getAvailableAssets helper
- [x] 7. Sidebar.jsx: filter nav by role, show role label
- [x] 8. AdminRoute.jsx: new admin-gating component
- [x] 9. App.jsx: wrap admin-only routes with AdminRoute
- [x] 10. Dashboard.jsx: add Available Assets section
- [x] 11. Hide action buttons for non-admins in Items, CheckInOut, Maintenance, Retirements, ItemDetail, Settings

## Verify
- [ ] 12. Test admin vs user flows
- [ ] 13. Build client to verify no compile errors
