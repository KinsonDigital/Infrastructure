<h1 align="center" style="color: mediumseagreen;font-weight: bold;">
Infrastructure Production Release Notes - v17.1.0
</h1>


<h2 align="center" style="font-weight: bold;">Features ✨</h2>

1. [#284](https://github.com/KinsonDigital/Infrastructure/issues/284) - Add new workflow input to the `dotnet-lib-release.yml` workflow that is used to enable or disable the build of the project when performing a release.
   - This is to give users the ability to perform the build themselves instead of letting the reusable workflow do the build.
