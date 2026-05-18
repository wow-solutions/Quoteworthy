import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Drop-in replacements for next/link, next/navigation that auto-include
// the current locale prefix. Use these instead of next/link in localized pages.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
