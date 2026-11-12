import { notFound } from 'next/navigation';
import { ProjectWorkspace } from '@/features/projects/workspace';
export const metadata = { title: 'محیط پروژه | BitroLearn' };
export default async function Page({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = await params; if (projectId !== 'my-first-api' && projectId !== 'MyFirstApi') notFound(); return <ProjectWorkspace />; }
