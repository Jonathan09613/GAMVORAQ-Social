// Utilidades de interfaz: iconos SVG en línea (Lucide), escape de HTML y pequeños componentes.
import { uiLocale } from './i18n/index.js';
import {
  House, Orbit, Images, Radio, BookOpen, UserRoundSearch, UsersRound, Target, Users, Gamepad2, Compass,
  MessagesSquare, MessageCircle, MessageSquare, UserRound, Bell, BellRing, ShieldCheck, Shield, ShieldAlert,
  Search, Plus, Send, X, Check, CheckCheck, ChevronRight, ChevronDown, ChevronLeft, ArrowLeft, ArrowRight,
  LogOut, LogIn, Menu, Settings, Flag, Heart, Sparkles, Star, Clock, Trophy, UserPlus, Camera, Eye, EyeOff,
  Pencil, ImagePlus, Image as ImageIcon, Power, Slash, ExternalLink, GitBranch, RadioTower, Flame, Moon, Sun, WifiOff, Wifi,
  Download, Bot, Crown, Zap, Command, Music, Headphones, Timer, Smile, Laugh, Dices, Brain, Swords, Lock, Mail,
  KeyRound, Rocket, Trash2, Play, Pause, SkipBack, SkipForward, Mic, LoaderCircle, RotateCcw, Volume2, VolumeX, Palette, SlidersHorizontal, LayoutDashboard,
  CalendarDays, Map as MapIcon, Globe, PartyPopper, Coffee, Wind, CloudRain, Info, TriangleAlert, CircleAlert, RefreshCw,
  Share2, Smartphone, Award, Medal, Gem, Megaphone, WandSparkles, Lightbulb, Hourglass, Pin, HandHeart,
  MessageCircleHeart, CloudOff, Database, AtSign, Ellipsis, Newspaper, Ghost, Joystick, Puzzle, Layers, Hand,
  Scissors, Gift, CircleHelp, UserCheck, CircleCheck, Handshake, HeartHandshake, Bookmark, Link, Copy, Save,
  Accessibility, BadgeCheck, Ban,
  Languages, CalendarPlus, CalendarClock, CalendarCheck, CircleDot, IdCard, MicOff, MessageSquareText, Signal,
  History, Monitor, Maximize, MonitorSmartphone, Shuffle, Droplet, Crosshair, BellOff, UserMinus, ImageUp, ClipboardCheck, Stethoscope,
  Vote, Tag, ListChecks, UserX, Gavel, Disc3, MessageCirclePlus, ChartColumn, Store, BadgePercent, ScanFace
} from 'lucide';

// Nombre (kebab-case) → nodo de icono. Los alias mantienen compatibilidad con nombres antiguos (home, edit…).
const ICONS = {
  'bell-off': BellOff, 'clipboard-check': ClipboardCheck, 'stethoscope': Stethoscope, 'user-minus': UserMinus, 'image-up': ImageUp,
  'shuffle': Shuffle, 'droplet': Droplet, 'crosshair': Crosshair,
  'monitor': Monitor, 'maximize': Maximize, 'monitor-smartphone': MonitorSmartphone,
  'house': House, 'home': House, 'orbit': Orbit, 'images': Images, 'radio': Radio, 'book-open': BookOpen,
  'user-round-search': UserRoundSearch, 'users-round': UsersRound, 'target': Target, 'users': Users,
  'gamepad-2': Gamepad2, 'compass': Compass, 'messages-square': MessagesSquare, 'message-circle': MessageCircle,
  'message-square': MessageSquare, 'user-round': UserRound, 'bell': Bell, 'bell-ring': BellRing,
  'shield-check': ShieldCheck, 'shield': Shield, 'shield-alert': ShieldAlert, 'search': Search, 'plus': Plus,
  'send': Send, 'x': X, 'check': Check, 'check-check': CheckCheck, 'chevron-right': ChevronRight,
  'chevron-down': ChevronDown, 'chevron-left': ChevronLeft, 'arrow-left': ArrowLeft, 'arrow-right': ArrowRight,
  'log-out': LogOut, 'log-in': LogIn, 'menu': Menu, 'settings': Settings, 'flag': Flag, 'heart': Heart,
  'sparkles': Sparkles, 'star': Star, 'clock': Clock, 'trophy': Trophy, 'user-plus': UserPlus, 'camera': Camera,
  'eye': Eye, 'eye-off': EyeOff, 'pencil': Pencil, 'edit': Pencil, 'image-plus': ImagePlus, 'image': ImageIcon,
  'power': Power, 'slash': Slash, 'external-link': ExternalLink, 'git-branch': GitBranch, 'radio-tower': RadioTower,
  'flame': Flame, 'moon': Moon, 'sun': Sun, 'wifi-off': WifiOff, 'wifi': Wifi, 'download': Download, 'bot': Bot,
  'crown': Crown, 'zap': Zap, 'command': Command, 'music': Music, 'headphones': Headphones, 'timer': Timer,
  'smile': Smile, 'laugh': Laugh, 'dices': Dices, 'brain': Brain, 'swords': Swords, 'lock': Lock, 'mail': Mail,
  'key-round': KeyRound, 'rocket': Rocket, 'trash-2': Trash2, 'play': Play, 'pause': Pause,
  'rotate-ccw': RotateCcw, 'skip-back': SkipBack, 'mic': Mic, 'loader': LoaderCircle, 'skip-forward': SkipForward, 'volume-2': Volume2, 'volume-x': VolumeX, 'palette': Palette,
  'sliders-horizontal': SlidersHorizontal, 'layout-dashboard': LayoutDashboard, 'calendar-days': CalendarDays,
  'map': MapIcon, 'globe': Globe, 'party-popper': PartyPopper, 'coffee': Coffee, 'wind': Wind, 'cloud-rain': CloudRain,
  'info': Info, 'triangle-alert': TriangleAlert, 'circle-alert': CircleAlert, 'refresh-cw': RefreshCw,
  'share-2': Share2, 'smartphone': Smartphone, 'award': Award, 'medal': Medal, 'gem': Gem, 'megaphone': Megaphone,
  'wand-sparkles': WandSparkles, 'lightbulb': Lightbulb, 'hourglass': Hourglass, 'pin': Pin,
  'hand-heart': HandHeart, 'message-circle-heart': MessageCircleHeart, 'cloud-off': CloudOff,
  'database': Database, 'at-sign': AtSign, 'ellipsis': Ellipsis, 'newspaper': Newspaper, 'ghost': Ghost,
  'joystick': Joystick, 'puzzle': Puzzle, 'layers': Layers, 'hand': Hand, 'scissors': Scissors, 'gift': Gift,
  'circle-help': CircleHelp, 'user-check': UserCheck, 'circle-check': CircleCheck, 'handshake': Handshake,
  'heart-handshake': HeartHandshake, 'bookmark': Bookmark, 'link': Link, 'copy': Copy, 'save': Save,
  'accessibility': Accessibility, 'badge-check': BadgeCheck, 'ban': Ban,
  'languages': Languages, 'calendar-plus': CalendarPlus, 'calendar-clock': CalendarClock, 'calendar-check': CalendarCheck,
  'circle-dot': CircleDot, 'id-card': IdCard, 'mic-off': MicOff, 'message-square-text': MessageSquareText, 'signal': Signal,
  'history': History, 'vote': Vote, 'tag': Tag, 'list-checks': ListChecks, 'user-x': UserX, 'gavel': Gavel, 'disc-3': Disc3,
  'message-circle-plus': MessageCirclePlus, 'chart-column': ChartColumn, 'store': Store, 'badge-percent': BadgePercent, 'scan-face': ScanFace
};

export function e(s) {
  return String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Devuelve un <svg> en línea. No requiere recorrer el DOM después de renderizar. */
export function icon(name, size = 18, cls = '') {
  const node = ICONS[name];
  if (!node) return '';
  const children = (node[2] || []).map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${e(v)}"`).join(' ')}/>`).join('');
  return `<svg class="i ${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${children}</svg>`;
}
export const hasIcon = name => Boolean(ICONS[name]);
/** Compatibilidad: ya no se necesita recorrer el DOM, los iconos son SVG en línea. */
export function iconsReady() {}

export function safeUrl(s) {
  try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? e(u.toString()) : ''; } catch { return ''; }
}

export function initials(p) { return e((p?.display_name || p?.username || 'G').trim().slice(0, 1).toUpperCase()); }

// Color estable por nombre para avatares sin foto y chips de género.
export function hueFor(text) {
  let h = 0; for (const ch of String(text || 'g')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h;
}

export function avatar(p, size = 'md') {
  if (p?.avatar_url && safeUrl(p.avatar_url)) return `<img class="avatar ${size}" src="${safeUrl(p.avatar_url)}" alt="" loading="lazy"/>`;
  const hue = hueFor(p?.username || p?.display_name);
  return `<span class="avatar ${size} avatar-letter" style="--h:${hue}" aria-hidden="true">${initials(p)}</span>`;
}

const rtfCache = {};
const rtfFor = loc => (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? (rtfCache[loc] ||= new Intl.RelativeTimeFormat(loc, { numeric: 'auto' })) : null);
export function time(s) {
  try { return new Intl.DateTimeFormat(uiLocale(), { day: 'numeric', month: 'short' }).format(new Date(s)); } catch { return ''; }
}
/** Tiempo relativo breve: "hace 5 min", "ayer". */
export function ago(s, now = Date.now()) {
  const t = new Date(s).getTime(); if (!Number.isFinite(t)) return '';
  const diff = Math.round((t - now) / 1000), abs = Math.abs(diff);
  if (abs < 45) return 'ahora';
  const rtf = rtfFor(uiLocale().slice(0, 2)); if (!rtf) return time(s);
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), 'day');
  return time(s);
}
export function greeting(hour) {
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function empty(text, ic = 'sparkles', action = '') {
  return `<div class="empty">${icon(ic, 34)}<p>${e(text)}</p>${action}</div>`;
}
export function chip(t, cls = '') { return `<span class="chip ${cls}">${e(t)}</span>`; }
export function btn(action, label, cls = 'btn btn-soft', attrs = '') {
  return `<button type="button" class="${cls}" data-action="${e(action)}" ${attrs}>${label}</button>`;
}
export function progress(pct, label = '') {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${v}" ${label ? `aria-label="${e(label)}"` : ''}><span style="width:${v}%"></span></div>`;
}
/** Anillo de porcentaje (compatibilidad SYNC, nivel…). */
export function ring(pct, label = '', size = 64) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return `<div class="ring" style="--v:${v};--s:${size}px" role="img" aria-label="${e(label || v + '%')}"><b>${v}<small>%</small></b></div>`;
}
export function skeleton(lines = 3) {
  return `<div class="skeleton-card" aria-hidden="true">${Array.from({ length: lines }, (_, i) => `<span class="sk" style="width:${95 - i * 17}%"></span>`).join('')}</div>`;
}
