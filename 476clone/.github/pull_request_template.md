## Description

<!-- Provide a clear and concise description of the changes -->

## Type of Change

<!-- Mark relevant items with [x] -->

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Security fix
- [ ] Performance improvement
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] CI/CD or infrastructure change

## Related Issues

<!-- Reference any related issues using #issue-number -->

Closes #

## Testing Performed

<!-- Describe the tests you ran to verify your changes -->

**Backend:**
- [ ] All existing tests pass (`php artisan test`)
- [ ] Added new tests for this change
- [ ] Security testing performed (if applicable)
- [ ] Performance testing performed (if applicable)

**Frontend (if applicable):**
- [ ] All existing tests pass (`pnpm test run`)
- [ ] TypeScript type-check passes (`pnpm run type-check`)
- [ ] Lint passes (`pnpm run lint`)
- [ ] Manual testing in browser completed
- [ ] Tested across all affected portals (parent / admin / super-admin / medical)

**Manual Testing:**
- [ ] Tested the happy path
- [ ] Tested error conditions and edge cases

### Test Environment

- PHP Version:
- MySQL Version:
- Laravel Version:
- Node Version:
- pnpm Version:

## Security Checklist

<!-- For changes that touch PHI or authentication/authorization -->

- [ ] No sensitive data is logged or exposed
- [ ] Authorization checks are in place
- [ ] Input validation is implemented using Form Requests
- [ ] SQL injection vulnerabilities addressed
- [ ] XSS vulnerabilities addressed
- [ ] CSRF protection in place (Sanctum handles this)
- [ ] Rate limiting applied where appropriate
- [ ] PHI access is audited (if applicable)

## Database Changes

<!-- If this PR includes database migrations -->

- [ ] Migration tested with `migrate:fresh`
- [ ] Migration rollback tested
- [ ] Migration is reversible (has `down()` method)
- [ ] No existing migrations modified
- [ ] Indexes added for performance (if applicable)
- [ ] Foreign key constraints defined

## Documentation

- [ ] Code is self-documenting with clear variable/method names
- [ ] Complex logic includes comments
- [ ] PHPDoc blocks added for public methods (backend)
- [ ] JSDoc/TSDoc added for public functions (frontend)
- [ ] README or docs updated (if applicable)
- [ ] API documentation updated (if applicable)
- [ ] `frontend/FRONTEND_GUIDE.md` updated (if frontend conventions changed)

## Code Quality

- [ ] Code follows Laravel coding standards
- [ ] Laravel Pint passes (`./vendor/bin/pint --test`)
- [ ] PHPStan passes (`./vendor/bin/phpstan analyse`)
- [ ] No debug code (dd(), dump(), var_dump()) left in
- [ ] No commented-out code blocks
- [ ] Controllers remain thin (business logic in Services)
- [ ] Follows single responsibility principle

## HIPAA Compliance

<!-- For changes affecting PHI or medical records -->

- [ ] PHI is encrypted at rest (using 'encrypted' cast)
- [ ] PHI access is logged via AuditPhiAccess middleware
- [ ] PHI is only accessible to authorized users
- [ ] Retention policies followed
- [ ] Audit logs retained for 90 days minimum

## Performance Considerations

- [ ] No N+1 query issues introduced
- [ ] Appropriate eager loading used
- [ ] Database queries optimized
- [ ] Large datasets paginated
- [ ] Cache strategy considered (if applicable)

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**Impact:**

**Migration Path:**

## Screenshots

<!-- If applicable, add screenshots to demonstrate UI changes -->

## Additional Notes

<!-- Any additional context or notes for reviewers -->

## Reviewer Checklist

<!-- For reviewers -->

- [ ] Code reviewed for security vulnerabilities
- [ ] Tests are comprehensive
- [ ] Documentation is adequate
- [ ] Breaking changes are acceptable
- [ ] Performance impact is acceptable
