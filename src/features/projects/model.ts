export interface ProjectFile { path: string; content: string }
export type ProjectAction = { type: 'create'; path: string } | { type: 'rename'; path: string; nextPath: string } | { type: 'delete'; path: string } | { type: 'edit'; path: string; content: string } | { type: 'reset' };

export const initialFiles: ProjectFile[] = [
  { path: 'Program.cs', content: 'using MyFirstApi.Services;\n\nvar builder = WebApplication.CreateBuilder(args);\n\nbuilder.Services.AddControllers();\nbuilder.Services.AddScoped<IUserService, UserService>();\n\nvar app = builder.Build();\n\napp.UseHttpsRedirection();\napp.MapControllers();\n\napp.Run();' },
  { path: 'Controllers/UsersController.cs', content: 'using Microsoft.AspNetCore.Mvc;\nusing MyFirstApi.Models;\nusing MyFirstApi.Services;\n\nnamespace MyFirstApi.Controllers;\n\n[ApiController]\n[Route("api/users")]\npublic class UsersController(IUserService users) : ControllerBase\n{\n    [HttpGet]\n    public ActionResult<IEnumerable<User>> GetAll()\n    {\n        return Ok(users.GetAll());\n    }\n\n    [HttpGet("{id:int}")]\n    public ActionResult<User> GetById(int id)\n    {\n        var user = users.GetById(id);\n        return user is null ? NotFound() : Ok(user);\n    }\n}' },
  { path: 'Services/IUserService.cs', content: 'using MyFirstApi.Models;\n\nnamespace MyFirstApi.Services;\n\npublic interface IUserService\n{\n    IReadOnlyList<User> GetAll();\n    User? GetById(int id);\n}' },
  { path: 'Services/UserService.cs', content: 'using MyFirstApi.Models;\n\nnamespace MyFirstApi.Services;\n\npublic class UserService : IUserService\n{\n    private readonly List<User> _users =\n    [\n        new User(1, "Arman", "arman@example.com"),\n        new User(2, "Sara", "sara@example.com")\n    ];\n\n    public IReadOnlyList<User> GetAll() => _users;\n\n    public User? GetById(int id) =>\n        _users.FirstOrDefault(user => user.Id == id);\n}' },
  { path: 'Models/User.cs', content: 'namespace MyFirstApi.Models;\n\npublic record User(\n    int Id,\n    string Name,\n    string Email\n);' },
  { path: 'appsettings.json', content: '{\n  "Logging": {\n    "LogLevel": {\n      "Default": "Information",\n      "Microsoft.AspNetCore": "Warning"\n    }\n  },\n  "AllowedHosts": "*"\n}' },
  { path: 'MyFirstApi.csproj', content: '<Project Sdk="Microsoft.NET.Sdk.Web">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n    <Nullable>enable</Nullable>\n    <ImplicitUsings>enable</ImplicitUsings>\n  </PropertyGroup>\n</Project>' },
];

export function validFilePath(path: string) { return /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/.test(path); }
export function projectReducer(files: ProjectFile[], action: ProjectAction): ProjectFile[] {
  switch (action.type) {
    case 'create': return !validFilePath(action.path) || files.some((f) => f.path === action.path) ? files : [...files, { path: action.path, content: action.path.endsWith('.cs') ? 'namespace MyFirstApi;\n\n// Start your code here\n' : '' }];
    case 'rename': return !validFilePath(action.nextPath) || files.some((f) => f.path === action.nextPath) ? files : files.map((f) => f.path === action.path ? { ...f, path: action.nextPath } : f);
    case 'edit': return files.map((f) => f.path === action.path ? { ...f, content: action.content } : f);
    case 'delete': return files.filter((f) => f.path !== action.path);
    case 'reset': return initialFiles.map((file) => ({ ...file }));
  }
}

export interface TerminalResult { output: string[]; running?: boolean; build?: boolean }
export function simulateCommand(command: string, pristine: boolean): TerminalResult {
  const normalized = command.trim().toLowerCase();
  if (normalized === 'help') return { output: ['Available preview commands:', '  dotnet build  — show curated build output', '  dotnet run    — start the API simulation', '  dotnet test   — show predefined example tests', '  ls            — list project files', '  clear         — clear terminal output', 'All commands are educational simulations.'] };
  if (normalized === 'dotnet build') return pristine ? { output: ['Determining projects to restore...', 'All projects are up-to-date for restore.', 'MyFirstApi -> bin/Debug/net8.0/MyFirstApi.dll', 'Build succeeded. [SIMULATED]', '    0 Warning(s)', '    0 Error(s)'], build: true } : { output: ['Modified workspace detected.', 'Real C# compilation is unavailable in this preview.', 'Restore the original sample to see its curated build output.'], build: false };
  if (normalized === 'dotnet run') return pristine ? { output: ['Building... [SIMULATED]', 'info: Microsoft.Hosting.Lifetime', '      Now listening on: http://localhost:5000 [SIMULATION]', '      Application started. Use the API panel to send a mock request.'], running: true } : { output: ['Run unavailable for modified projects.', 'This preview does not compile or execute edited C# code.'], running: false };
  if (normalized === 'dotnet test') return pristine ? { output: ['Starting predefined test scenario... [SIMULATED]', 'PASS  GET /api/users returns 2 users', 'PASS  GET /api/users/1 returns Arman', 'PASS  GET /api/users/999 returns 404', 'Preview results: 3 passed, 0 failed. No real tests were executed.'] } : { output: ['Edited project cannot be graded in this frontend preview.', 'Reset the sample for predefined test results.'] };
  return { output: [`Unknown preview command: ${command}`, 'Type help to see available simulated commands.'] };
}

export function isPristine(files: ProjectFile[]): boolean { return files.length === initialFiles.length && initialFiles.every((sample) => files.some((file) => file.path === sample.path && file.content === sample.content)); }

export function apiResponse(path: string) {
  const users = [{ id: 1, name: 'Arman', email: 'arman@example.com' }, { id: 2, name: 'Sara', email: 'sara@example.com' }];
  const normalized = path.trim().replace(/\/$/, '');
  if (normalized === '/api/users') return { status: 200, text: 'OK', body: users };
  const id = normalized.match(/^\/api\/users\/(\d+)$/)?.[1];
  const user = id ? users.find((item) => item.id === Number(id)) : undefined;
  if (user) return { status: 200, text: 'OK', body: user };
  return { status: 404, text: 'Not Found', body: { title: 'Not Found', status: 404, detail: 'No matching resource in this educational API simulation.' } };
}
