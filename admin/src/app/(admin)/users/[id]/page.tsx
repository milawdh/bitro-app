import { UserDetail } from '@/features/people/users';
export default async function UserRoute({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <UserDetail key={id} id={id} />; }
