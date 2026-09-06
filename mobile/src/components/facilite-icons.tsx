import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// Icônes vectorielles portées directement des tracés SVG du dossier de
// design (design_handoff_facilite/pages/*.html) — reproduction pixel-perfect
// des chemins fournis plutôt qu'un pictogramme générique approchant
// (Ionicons), pour respecter l'exigence de fidélité "hifi" du handoff.

type IconProps = { size?: number; color?: string };
type NavIconProps = IconProps & { active?: boolean };

const NOIR = '#1A1A1A';

export function IconAccueil({ size = 19, color = NOIR, active }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 11L12 4L20 11V20H14V14H10V20H4V11Z"
        fill={active ? color : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconExtracteur({ size = 19, color = NOIR, active }: NavIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L4 14H11L10 22L20 9H13L13 2Z"
        fill={active ? color : 'none'}
        stroke={active ? 'none' : color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconOffres({ size = 19, color = NOIR }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={7} x2={19} y2={7} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={5} y1={17} x2={14} y2={17} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconMessages({ size = 19, color = NOIR }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5H20V16H9L5 19.5V16H4V5Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconNotifs({ size = 19, color = NOIR }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 10a6 6 0 0112 0v4l1.5 2.5h-15L6 14v-4z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path d="M10 19a2 2 0 004 0" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconAdmin({ size = 19, color = '#EA580C' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3L19 6V11C19 15.4 16 18.9 12 20C8 18.9 5 15.4 5 11V6L12 3Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function IconProfilCercle({ size = 16, color = NOIR }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={3.5} stroke={color} strokeWidth={1.8} />
      <Path
        d="M4.5 20C5.5 15.8 8.4 14 12 14C15.6 14 18.5 15.8 19.5 20"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconRecherche({ size = 20, color = NOIR, strokeWidth = 1.8 }: IconProps & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={10.5} cy={10.5} r={6.5} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={15.5} y1={15.5} x2={20.5} y2={20.5} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function IconMenuHamburger({ size = 20, color = NOIR }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={4} y1={6} x2={20} y2={6} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4} y1={12} x2={20} y2={12} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={4} y1={18} x2={20} y2={18} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconChevronGauche({ size = 15, color = '#2563EB', strokeWidth = 2 }: IconProps & { strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 5L8 12L15 19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconChevronBas({ size = 12, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 9L12 15L18 9" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconEtincelle({ size = 14, color = '#6ee7c9' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L14 9L21 9L15.5 13.5L17.5 21L12 16.5L6.5 21L8.5 13.5L3 9L10 9L12 2Z" fill={color} />
    </Svg>
  );
}

export function IconHorloge({ size = 13, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={1.6} />
      <Path d="M12 8V12L14.5 14" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function IconPhoto({ size = 16, color = '#10B981' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke={color} strokeWidth={1.6} />
      <Circle cx={9} cy={11} r={2} stroke={color} strokeWidth={1.6} />
      <Path d="M3 16L8 12L13 16L17 13L21 16" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconDocument({ size = 16, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3H14L18 7V21H6V3Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M14 3V7H18" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function IconImporter({ size = 20, color = '#10B981' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={6} width={18} height={13} rx={2} stroke={color} strokeWidth={1.6} />
      <Circle cx={12} cy={12.5} r={3.2} stroke={color} strokeWidth={1.6} />
      <Path d="M9 6L10.2 4H13.8L15 6" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function IconEnvoyer({ size = 16, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11L21 3L13 21L11 13L3 11Z" fill={color} />
    </Svg>
  );
}

export function IconPouceLeve({ size = 17, color = 'rgba(0,0,0,0.55)' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11V21H4V11H7ZM7 11L11 3C12.5 3 13.5 4.2 13 5.5L11.5 9H19C20 9 20.7 10 20.4 11L18.7 18C18.5 19 17.6 19.7 16.6 19.7H10.5C9 19.7 7.5 19.2 7 18.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconPartager({ size = 16, color = 'rgba(0,0,0,0.55)' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3V15M12 3L7 8M12 3L17 8" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 14V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V14" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconEnregistrer({ size = 16, color = 'rgba(0,0,0,0.55)' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3.5H18V21L12 16.5L6 21V3.5Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function IconDossier({ size = 17, color = '#fff' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8H20V19H4V8Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9 8V6C9 5 9.7 4 11 4H13C14.3 4 15 5 15 6V8" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

export function IconClotureExpiree({ size = 16, color = '#DC2626' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3H18M6 21H18M7 3C7 8 12 9.5 12 12C12 14.5 7 16 7 21M17 3C17 8 12 9.5 12 12C12 14.5 17 16 17 21"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function IconCrayon({ size = 18, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 20L5 16L16 5L19 8L8 19L4 20Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </Svg>
  );
}

export function IconPoints({ size = 18, color = '#1A1A1A' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx={12} cy={5} r={1.6} />
      <Circle cx={12} cy={12} r={1.6} />
      <Circle cx={12} cy={19} r={1.6} />
    </Svg>
  );
}
