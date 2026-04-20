
Clear-Host;

Write-Host "Please enter the issue number:" -ForegroundColor Cyan;
$issueNumber = Read-Host;
$issueNumber = gh issue view $issueNumber --json number 2>$null | ConvertFrom-Json;

# Does the issue number exist
if ($null -eq $issueNumber) {
    Write-Host "Issue #$issueNumber does not exist. Please create the issue before running this script." -ForegroundColor DarkRed;
    exit 1;
}

# Get the title of the issue.
$issueTitle = gh issue view $issueNumber --json title --jq ".title";

Write-Host "Please enter the name of the branch:" -ForegroundColor Cyan;
$branchName = Read-Host;
$branchName = $branchName.ToLower();
$branchName = $branchName.StartsWith("feature/") ? $branchName.Substring(8) : $branchName;
$branchName = $branchName.Replace(" ", "-");
$branchName = "feature/$issueNumber-$branchName";

$currentBranch = git branch --show-current

if ($currentBranch -ne "main") {
    git checkout main;
    git checkout release;
    git checkout -B $branchName;
    git commit --allow-empty -m "Start work for issue: $issueNumber";
    git push --set-upstream origin $branchName;
    
    gh pr create -H release -B main -t "$issueTitle" -F ".\templates\pr-template.md";
}
