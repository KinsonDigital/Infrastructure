### Pre-Release ToDo List

- [ ] All issues in the assigned milestone are closed and all issue tasks are complete.
- [ ] Add _**`🚀Preview Release`**_ label to this pull request.
- [ ] The pull request is assigned to a project.
- [ ] The pull request is assigned to a milestone.
- [ ] All unit tests have been executed locally and have passed. _(Check out the appropriate release branch before running tests).
- [ ] The version in csharp project file updated.
- [ ] Auto-generated release notes have been reviewed and updated if necessary.
- [ ] Manual QA Testing completed _(if applicable)_.
- [ ] Release to **_preview_** completed. _(The release is performed by running the `🚀Release` workflow)_.

### Post-Release ToDo List

- [ ] The GitHub release has been created and is correct.
- [ ] The NuGet package has been successfully deployed to [nuget.org](https://www.nuget.org/) _(if applicable)_.
- [ ] Announcement of release on [Twitter](https://twitter.com/KDCoder) verified. _(if applicable - The announcement should be performed automatically with the release)_.
- [ ] An announcement has been pushed to the [Discord](https://discord.gg/qewu6fNgv7) channel. _(if applicable)_
- [ ] Documentation website released with updated or added tutorials. _(if applicable)_
- [ ] The documentation website has been released with updated API changes. _(if applicable)_

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
