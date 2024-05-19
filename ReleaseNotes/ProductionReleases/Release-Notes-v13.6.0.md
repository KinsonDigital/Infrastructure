<h1 align="center" style='color:mediumseagreen;font-weight:bold'>
   Infrastructure Production Release Notes - v13.6.0
</h1>

<h2 style="font-weight:bold" align="center">New Features ✨</h2>

1. [#202](https://github.com/KinsonDigital/Infrastructure/issues/202) - Added dotnet SDK check system.
    - This system was created as a reusable workflow so other organization projects can create status checks for the dotnet SDK setup of the project.
    - Added check to reusable dotnet release workflows for dotnet library and action releases

---

<h2 align="center" style="font-weight: bold;">Dependency Updates 📦</h2>

[#202](https://github.com/KinsonDigital/Infrastructure/issues/202) - Added the `walkSync` module `v0.207.0` to the project.

---

<h2 style="font-weight:bold" align="center">Other 🪧</h2>
<h5 align="center">(Includes anything that does not fit into the categories above)</h5>

1. [#202](https://github.com/KinsonDigital/Infrastructure/issues/202) - Made various changes to the VSCode ide configuration.
2. [#202](https://github.com/KinsonDigital/Infrastructure/issues/202) - Made the following CICD changes:
    - Updated all deno versions to use repo variable
    - Added dotnet sdk setup validation to dotnet release workflows
    - Updated workflows to use preview branch
    - Removed testing workflow
    - Improved version regex in workflow validation job
    - Setup workflow version status check to only run for release branches
    - Changed emoji of reusuable workflows
    - Rearranged workflow inputs and input usage
3. [#202](https://github.com/KinsonDigital/Infrastructure/issues/202) - Performed various refactoring changes and added the following improvements:
    - Improved csharp version service by using new util funcs
    - Cleaned and reformat code to project coding standards
    - Added util funcs for dotnet sdk versions
    - Created func to check if a csproj contains the target framework tag
    - Improved version regex
    - Added task to deno config file
