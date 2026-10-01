import { permanentRedirect } from "next/navigation";

// Phone (SMS) sign-in was never switched on in production and is not part of
// the new authentication; old links land on the normal sign-in page.
export default function PhoneLoginRemoved() {
  permanentRedirect("/giris");
}
