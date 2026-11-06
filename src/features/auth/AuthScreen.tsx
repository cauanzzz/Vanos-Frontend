import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Notice } from '@/components/ui/Notice';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import { errorMessage } from '@/services/errors';
import { useAuth } from '@/store/auth';
import { isRole, type Role } from '@/types/roles';
import { profiles } from '../welcome/roles';
import { emptyForm, registrationInput, validateForm, type AuthForm, type FormErrors } from './validation';

export function AuthScreen({ register = false }: { register?: boolean }) {
  const params = useLocalSearchParams<{ role?: string | string[] }>();
  const [role, setRole] = useState<Role>(isRole(params.role) ? params.role : 'Parent');
  const [form, setForm] = useState<AuthForm>({ ...emptyForm });
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [visiblePassword, setVisiblePassword] = useState(false);
  const busy = useAuth((state) => state.busy);
  const login = useAuth((state) => state.login);
  const signup = useAuth((state) => state.register);
  const notice = useAuth((state) => state.notice);

  function update(key: keyof AuthForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setMessage(null);
  }
  async function submit() {
    if (busy) return;
    const nextErrors = validateForm(form, register, role);
    setErrors(nextErrors);
    setMessage(null);
    if (Object.keys(nextErrors).length) return;
    try {
      if (register) await signup(registrationInput(form, role));
      else await login({ email: form.email.trim().toLowerCase(), password: form.password });
    } catch (error: unknown) {
      setMessage(errorMessage(error));
      setForm((current) => ({ ...current, password: '' }));
    }
  }
  return (
    <Screen>
      <Link href="/" accessibilityLabel="Voltar ao início" className="mb-8 py-3 text-base font-semibold text-forest">← Início</Link>
      <Typography variant="caption" tone="forest" className="mb-3 font-semibold tracking-[2px]">SEU CAMINHO COMEÇA AQUI</Typography>
      <Typography variant="display">{register ? 'Vamos nos conhecer.' : 'Bom ter você de volta.'}</Typography>
      <Typography tone="muted" className="mb-7 mt-4">{register ? 'Crie sua conta para fazer parte do Vanos.' : 'Entre com o e-mail e a senha da sua conta.'}</Typography>
      {Platform.OS === 'web' && <View className="mb-5"><Notice title="Acesso pelo navegador">Sua sessão fica apenas na memória deste navegador. Ao recarregar a página, será necessário entrar novamente.</Notice></View>}
      {(message || notice) && <View accessibilityRole="alert" className="mb-5 rounded-2xl bg-warning p-4"><Typography>{message ?? notice}</Typography></View>}
      <View className="gap-5">
        {register && (
          <View className="gap-2" accessibilityRole="radiogroup">
            <Typography variant="label">Como você usará o Vanos?</Typography>
            {profiles.map((profile) => (
              <Pressable key={profile.role} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: role === profile.role, disabled: busy }}
                onPress={() => { setRole(profile.role); setErrors({}); setMessage(null); }}
                className={`min-h-12 rounded-xl border px-4 py-3 ${role === profile.role ? 'border-forest bg-sage' : 'border-line'}`}>
                <Typography variant="label">{role === profile.role ? '● ' : '○ '}{profile.title}</Typography>
              </Pressable>
            ))}
          </View>
        )}
        <FormField label="E-mail" value={form.email} onChangeText={(v) => update('email', v)} error={errors.email}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="emailAddress" maxLength={254} editable={!busy} />
        <View>
          <FormField label="Senha" value={form.password} onChangeText={(v) => update('password', v)} error={errors.password}
            autoCapitalize="none" autoCorrect={false} secureTextEntry={!visiblePassword} editable={!busy}
            autoComplete={register ? 'new-password' : 'current-password'} textContentType={register ? 'newPassword' : 'password'}
            returnKeyType={register && role === 'Driver' ? 'next' : 'go'}
            onSubmitEditing={register && role === 'Driver' ? undefined : () => { void submit(); }} />
          <Pressable accessibilityRole="button" accessibilityLabel={visiblePassword ? 'Ocultar senha' : 'Mostrar senha'}
            onPress={() => setVisiblePassword((current) => !current)} className="min-h-12 justify-center self-start py-3">
            <Typography variant="caption" tone="forest">{visiblePassword ? 'Ocultar senha' : 'Mostrar senha'}</Typography>
          </Pressable>
          {register && <Typography variant="caption" tone="muted">Pelo menos 8 caracteres. Limite de 72 bytes.</Typography>}
        </View>
        {register && role === 'Driver' && (
          <>
            <Typography variant="title">Você e sua van</Typography>
            <FormField label="Nome completo" value={form.fullname} onChangeText={(v) => update('fullname', v)} error={errors.fullname} autoComplete="name" editable={!busy} />
            <FormField label="CPF" value={form.cpf} onChangeText={(v) => update('cpf', v)} error={errors.cpf} keyboardType="number-pad" editable={!busy} />
            <FormField label="Telefone" value={form.phoneNumber} onChangeText={(v) => update('phoneNumber', v)} error={errors.phoneNumber} keyboardType="phone-pad" autoComplete="tel" editable={!busy} />
            <FormField label="Placa da van" value={form.licensePlate} onChangeText={(v) => update('licensePlate', v)} error={errors.licensePlate} autoCapitalize="characters" editable={!busy} />
            <FormField label="Capacidade de passageiros" value={form.studentCapacity} onChangeText={(v) => update('studentCapacity', v)} error={errors.studentCapacity} keyboardType="number-pad" editable={!busy} />
            <FormField label="Chave Pix" value={form.pixKey} onChangeText={(v) => update('pixKey', v)} error={errors.pixKey} autoCapitalize="none" autoCorrect={false} editable={!busy} />
          </>
        )}
        <Button label={register ? 'Criar minha conta' : 'Entrar na minha conta'} loading={busy} onPress={() => { void submit(); }} />
        {!busy && <Link href={register ? '/login' : { pathname: '/register', params: { role } }} className="py-4 text-center text-base font-semibold text-forest">
          {register ? 'Já tenho uma conta · Entrar' : 'Ainda não tenho conta · Cadastrar'}
        </Link>}
        {register && <Typography variant="caption" tone="muted" className="pb-4">O cadastro da conta de responsável ou estudante é separado do perfil de passageiro e do vínculo com o motorista.</Typography>}
      </View>
    </Screen>
  );
}
