# TODO: Role-based access + Available assets dashboard

## Backend
- [ ] 1. schema.sql: allow role 'user' in users CHECK constraint
- [ ] 2. init.js: migration to rebuild users table for existing DBs with 'user' role
- [ ] 3. middleware/auth.js: add requireAdmin middleware
- [ ] 4. routes: apply requireAdmin to write/admin operations
- [ ] 5. dashboardController: add availableByCategory + availableAssets to summary

## Frontend
- [ ] 6. api.js: add getAvailableAssets helper
- [ ] 7. Sidebar.jsx: filter nav by role, show role label
- [ ] 8. AdminRoute.jsx: new admin-gating component
- [ ] 9. App.jsx: wrap admin-only routes with AdminRoute
- [ ] 10. Dashboard.jsx: add Available Assets section
- [ ] 11. Hide action buttons for non-admins in Items, CheckInOut, Maintenance, Retirements, ItemDetail, Settings

## Verify
- [ ] 12. Test admin vs user flows
