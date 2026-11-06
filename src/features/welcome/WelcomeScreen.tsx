import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { Typography } from '@/components/ui/Typography';
import type { Role } from '@/types/roles';
import { profiles } from './roles';

export function WelcomeScreen() {
  const [role, setRole] = useState<Role>('Parent');

  return (
    <Screen>
      <View className="flex-row flex-wrap items-center justify-between gap-3">
        <Typography className="text-[30px] font-bold tracking-[-1px]">vanos<TextDot /></Typography>
        <View className="rounded-full border border-line px-3 py-1.5">
          <Typography variant="caption" tone="muted">ESCOLA · UNIVERSIDADE</Typography>
        </View>
      </View>

      <View className="mb-8 mt-10 overflow-hidden rounded-[28px] bg-ink px-6 py-7">
        <Typography variant="caption" tone="lime" className="mb-6 font-semibold tracking-[2px]">BONS CAMINHOS, TODOS OS DIAS</Typography>
        <Typography variant="display" tone="canvas">O caminho é melhor{ '\n' }quando conecta.</Typography>
        <Typography tone="onDark" className="mt-4">Famílias, estudantes e motoristas.{ '\n' }Cada um no seu caminho. Todos mais perto.</Typography>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" className="mt-8 flex-row items-center">
          <View className="h-4 w-4 rounded-full border-[3px] border-lime" />
          <View className="h-px flex-1 bg-[#6C8976]" />
          <View className="rounded-full bg-lime px-4 py-2">
            <Typography variant="caption" className="font-bold">v →</Typography>
          </View>
          <View className="h-px flex-1 bg-[#6C8976]" />
          <View className="h-4 w-4 rounded-sm bg-lime" />
        </View>
      </View>

      <Typography variant="title">Como você chega até aqui?</Typography>
      <Typography tone="muted" className="mb-5 mt-1">Escolha seu perfil para conhecer seu acesso.</Typography>

      <View accessibilityRole="radiogroup" className="mb-6 gap-2">
        {profiles.map((profile) => {
          const selected = profile.role === role;
          return (
            <Pressable
              key={profile.role}
              accessibilityRole="radio"
              accessibilityLabel={`${profile.title}. ${profile.description}`}
              accessibilityState={{ checked: selected }}
              onPress={() => setRole(profile.role)}
              className={`min-h-20 flex-row items-center gap-4 rounded-2xl border p-4 ${selected ? 'border-forest bg-sage' : 'border-line bg-canvas'}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className={`h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-forest' : 'border-muted'}`}>
                {selected && <View className="h-2.5 w-2.5 rounded-full bg-forest" />}
              </View>
              <View className="flex-1 gap-0.5">
                <Typography variant="label">{profile.title}</Typography>
                <Typography variant="caption" tone="muted">{profile.description}</Typography>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-auto gap-4">
        <Button label="Conhecer meu acesso →" onPress={() => router.push({ pathname: '/access', params: { role } })} />
        <Link href="/login" className="py-3 text-center text-base font-semibold text-forest">Já tenho uma conta · Entrar</Link>
      </View>
    </Screen>
  );
}

function TextDot() {
  return <Typography tone="forest" className="text-[30px] font-bold">.</Typography>;
}
