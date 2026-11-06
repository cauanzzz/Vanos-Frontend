import { Text, type TextProps } from 'react-native';

type Props = TextProps & {
  variant?: 'display' | 'title' | 'body' | 'label' | 'caption';
  tone?: 'ink' | 'muted' | 'canvas' | 'forest' | 'lime' | 'onDark';
};

const tones = {
  ink: 'text-ink', muted: 'text-muted', canvas: 'text-canvas',
  forest: 'text-forest', lime: 'text-lime', onDark: 'text-[#D2DED7]',
};

const variants = {
  display: 'text-[42px] leading-[47px] font-semibold tracking-[-1.5px]',
  title: 'text-2xl leading-8 font-semibold tracking-[-0.5px]',
  body: 'text-base leading-6',
  label: 'text-base leading-6 font-semibold',
  caption: 'text-sm leading-5',
};

export function Typography({ variant = 'body', tone = 'ink', className = '', ...props }: Props) {
  return (
    <Text
      accessibilityRole={variant === 'display' || variant === 'title' ? 'header' : undefined}
      className={`${tones[tone]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
