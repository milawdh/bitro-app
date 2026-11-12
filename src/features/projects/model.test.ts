import { describe, expect, it } from 'vitest';
import { apiResponse, initialFiles, isPristine, projectReducer, simulateCommand } from './model';

describe('project workspace operations', () => {
  it('creates, renames, edits and removes a file without mutating the original', () => {
    const created = projectReducer(initialFiles, { type: 'create', path: 'Models/Post.cs' });
    const renamed = projectReducer(created, { type: 'rename', path: 'Models/Post.cs', nextPath: 'Models/Article.cs' });
    const edited = projectReducer(renamed, { type: 'edit', path: 'Models/Article.cs', content: 'record Article(int Id);' });
    expect(edited.find((file) => file.path === 'Models/Article.cs')?.content).toBe('record Article(int Id);');
    expect(projectReducer(edited, { type: 'delete', path: 'Models/Article.cs' })).toEqual(initialFiles);
    expect(initialFiles).toHaveLength(7);
  });
  it('rejects duplicate names and unsafe paths', () => {
    expect(projectReducer(initialFiles, { type: 'create', path: 'Program.cs' })).toBe(initialFiles);
    expect(projectReducer(initialFiles, { type: 'create', path: '../secret.cs' })).toBe(initialFiles);
    expect(projectReducer(initialFiles, { type: 'rename', path: 'Program.cs', nextPath: 'Models/User.cs' })).toBe(initialFiles);
  });
  it('does not report successful compilation for user edits', () => {
    const edited = projectReducer(initialFiles, { type: 'edit', path: 'Program.cs', content: 'not valid csharp' });
    expect(isPristine(edited)).toBe(false);
    expect(simulateCommand('dotnet build', isPristine(edited)).build).toBe(false);
    expect(simulateCommand('dotnet run', isPristine(edited)).running).toBe(false);
  });
  it('provides deterministic mock API status codes', () => {
    expect(apiResponse('/api/users').status).toBe(200);
    expect(apiResponse('/api/users/1').body).toEqual({ id: 1, name: 'Arman', email: 'arman@example.com' });
    expect(apiResponse('/api/users/999').status).toBe(404);
    expect(apiResponse('/admin').status).toBe(404);
  });
});
