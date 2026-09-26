/**
 * The public form stands alone.
 *
 * No sidebar, no header, no product chrome: somebody arriving from a shared
 * link is here to answer a form, and the app's navigation would only invite
 * them somewhere else. The root layout still provides the fonts, the theme and
 * `dir="rtl"`.
 */
export default function PublicFormLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
