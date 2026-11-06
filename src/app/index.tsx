import { Redirect } from 'expo-router';
import { WelcomeScreen } from '@/features/welcome/WelcomeScreen';
import { useAuth } from '@/store/auth';

export default function IndexScreen() {
  const session = useAuth((state) => state.session);
  if (session) return <Redirect href={session.role === 'Driver' ? '/driver' : '/passenger'} />;
  return <WelcomeScreen />;
}
