import { redirect } from 'next/navigation';

/** The panel has one section so far; the root opens it. */
export default function AdminHomePage() {
  redirect('/users');
}
