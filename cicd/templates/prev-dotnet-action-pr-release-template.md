### Pre-Release ToDo List

- [ ] All issues in the assigned milestone are closed and all issue tasks are complete.
- [ ] Add _**`🚀Preview Release`**_ label to this pull request.
- [ ] The pull request is assigned to a project.
- [ ] All unit tests have been executed locally and have passed. _(Check out the appropriate release branch before running tests).
- [ ] The version in csharp project file updated.
- [ ] Release notes created.
- [ ] Release to **_preview_** completed. _(The release is performed by running the `🚀Release` workflow)_.

### Post-Release ToDo List

- [ ] The GitHub release has been created and is correct.

### Additional Information:

**_<details closed><summary>Unit Tests</summary>_**

Reasons for local unit test execution:
- Unit tests might pass locally but not in the CI environment during the status check process or vice-versa.
- Tests might pass on the developer's machine but not necessarily on the code reviewer's machine.
</details>

---

**_<details closed><summary>Version Updating</summary>_**

The version can be updated by setting the values of the `<Version/>` and `<FileVersion/>` XML tags in the project file.
The `<Version/>` and `<FileVersion/>` values can hold the preview release version.
The `<AssemblyVersion/>` XML tag can only hold production values.  Preview values are not allowed.

``` xml
<!--Preview Release Example-->
<Version>1.2.3-preview.4</Version>
<FileVersion>1.2.3-preview.4</FileVersion>
<AssemblyVersion>1.2.3</AssemblyVersion>
```
</details>

---

### Code of Conduct

- [ ]  I agree to follow this project's Code of Conduct
