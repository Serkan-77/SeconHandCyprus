import { permanentRedirect } from "next/navigation";

// Profile editing moved into Settings.
export default function EditProfileMoved() {
  permanentRedirect("/hesabim/ayarlar#profil");
}
