# npm release targets

LocalHelm reads the enrolled directory's `package.json` by default. Its `private` flag controls npm publishing independently of GitHub repository visibility.

For a generated public package, check in `localhelm.release.json` at the enrolled root:

```json
{
  "version": 1,
  "directory": ".artifacts/npm-package",
  "manifest": "packages/cli/release.json",
  "readme": "packages/cli/README.md",
  "buildScript": "package:build",
  "kind": "cli",
  "executables": ["example"]
}
```

All paths are relative to and contained within the checkout. `manifest` is the authoritative JSON source containing the public name/version/license and optional bin declarations; Bump edits and commits this source. `readme` names the authoritative documentation. `buildScript` runs from the enrolled root and must create `directory/package.json`, entry files, and README. Keep generated output ignored. The private development harness can remain private. Git, dependency graph, and deployment continue to use the enrolled checkout. Libraries use `kind: "package"` and need no executable. Configuration mistakes surface as status errors.

Opening Publish only reads a plan. After confirmation, LocalHelm bumps and commits if needed, runs the build and `prepublishOnly`, then packs with npm's prepack/prepare/postpack lifecycle. It inspects the archive's identity, license, README bytes, and executable files before any necessary push. Changed sources/HEAD or archive bytes stop the release. Publication sends that exact archive without rebuilding. The result and Activity include a digest, file list, and a local `verification.json` receipt beside the archive. Publish/postpublish hooks run after registry acknowledgement; their failure is a warning on a completed publication.

A GitHub Actions publish link hands release ownership to that workflow. It does not claim that LocalHelm verified its artifact. Fix the workflow's target/build/verification there. A quiet dashboard row does not establish that npm's README or files match the checkout; compare the published version and package contents when validating a release.

Build/pack failures leave the package unpublished. Review the error and any build changes, refresh status, and open a new plan. A version bump committed before a failed build can be reused on that fresh plan. Never repeat an uncertain registry write before checking npm.
