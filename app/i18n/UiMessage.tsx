'use client';
import { useUiText } from './LocaleProvider';
export default function UiMessage({ source }: { source: string }) { return useUiText()(source); }
