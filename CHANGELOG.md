### Changelog

All notable changes to this project will be documented in this file.

#### 0.2.0

- Added optional **Jurisdiction** and **Interaction Type** fields under Additional Fields, matching the `jurisdiction`/`interaction_type` parameters the Python SDK exposes as of `disclarion` 0.3.0. Both feed the backend's Obligation Engine. Backward compatible: an n8n collection field only ends up in the request if the workflow author explicitly adds it, so any workflow built before this existed sends the exact same request it always did.

#### 0.1.2

- Verify GitHub Actions publishing via npm OIDC Trusted Publishing.

#### 0.1.1

- Fix broken 0.1.0 publish: republish with the `dist/` build actually included.

#### 0.1.0

- Initial release: Track Interaction operation, API key credential with key verification.
