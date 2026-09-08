import AdminGuard from "@/components/AdminGuard";
import { PracticeManager } from "../page";

export default function AdminPracticePyqsPage() {
  return <AdminGuard><PracticeManager library="pyq" /></AdminGuard>;
}
