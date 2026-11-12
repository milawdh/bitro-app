import { ChallengeDetail } from '@/features/challenges/challenge-pages';
export default async function Page({ params }: { params: Promise<{ challengeSlug: string }> }) { const { challengeSlug } = await params; return <ChallengeDetail key={challengeSlug} slug={challengeSlug} />; }
