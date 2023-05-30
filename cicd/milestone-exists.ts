if (Deno.args.length != 3) {
    const scriptName = Deno.mainModule.substring(Deno.mainModule.lastIndexOf("/") + 1);
    let errorMsg = `The '${scriptName}' cicd script must have 3 arguments.`;
    errorMsg += "\nThe first arg must be the GitHub project name.";
    errorMsg += "\nThe second arg must be the title of the milestone.";
    errorMsg += "\nThe third arg must be the GitHub token.";

    console.log(`::error::${errorMsg}`);
    Deno.exit(1);
}

const projectName = Deno.args[0].trim();
const milestone = Deno.args[1].trim();
const githubToken = Deno.args[2].trim();

console.log("::group::Argument Values");
console.log(`Project Name: ${projectName}`);
console.log(`Milestone: ${milestone}`);
console.log("GitHub Token: ****");
console.log("::endgroup::");

const milestoneUrl = `https://api.github.com/repos/KinsonDigital/${projectName}/milestones?state=all`;

const headers: Headers = new Headers();

headers.append("Accept", "application/vnd.github.v3+.json");
headers.append("X-GitHub-Api-Version", "2022-11-28");
headers.append("Authorization", `Bearer ${githubToken}`);

const response: Response = await fetch(milestoneUrl, {
    method: "GET",
    headers: headers,
});

if (response.status === 404) {
    console.log(`::error::The milestone '${milestone}' for project '${projectName}' does not exist.`);
    Deno.exit(1);
} 

const responseText: string = await response.text();
const responseData = await JSON.parse(responseText);

let milestones: string[] = responseData.map((milestone: any) => milestone.title);

// Trim all of the milestone names
milestones = milestones.map((milestone: string) => milestone.trim());

// Check if the milestone exists
if (milestones.includes(milestone)) {
    console.log(`✅The milestone '${milestone}' for project '${projectName}' exists!!✅`);
} else {
    console.log(`::error::The milestone '${milestone}' for project '${projectName}' does not exist.`);
}
