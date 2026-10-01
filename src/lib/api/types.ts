// Shapes of the API's JSON responses (api/src/modules/*). Dates arrive as ISO
// strings. Kept in one place so pages and components agree on them.
import type { AttributeDef, SpecGroup } from "../../../shared/attributes.ts";

export type ImageUrls = { sm: string; md: string; lg: string };

export type CategoryRef = { id: number; slug: string; name: string; nameEn: string | null };

export type Category = {
  id: number;
  parentId: number | null;
  slug: string;
  name: string;
  nameEn: string | null;
  icon: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type Region = { name: string; slug: string; side: "north" | "south"; lat: number; lng: number };

export type Taxonomy = { categories: Category[]; attributes: AttributeDef[]; regions: Region[] };

export type ListingStatus = "draft" | "pending" | "active" | "rejected" | "sold" | "removed";

export type ListingCard = {
  id: string;
  refNo: number;
  slug: string;
  title: string;
  price: number;
  currency: string;
  city: string;
  district: string | null;
  condition: string;
  status: ListingStatus;
  featured: boolean;
  negotiable: boolean;
  viewCount: number;
  createdAt: string;
  publishedAt: string | null;
  category: CategoryRef | null;
  image: ImageUrls | null;
  photoCount: number;
  facts: string[];
  factsEn: string[];
  seller: { id: string; name: string; isStore: boolean; storeVerified: boolean };
};

export type SearchResult = {
  items: ListingCard[];
  total: number;
  page: number;
  pageSize: number;
  facets: { categoryId: number; count: number }[];
};

export type ListingDetail = ListingCard & {
  description: string;
  attributes: Record<string, unknown>;
  specs: SpecGroup[];
  specsEn: SpecGroup[];
  rejectReason: string | null;
  updatedAt: string;
  images: { id: string; urls: ImageUrls | null; width: number | null; height: number | null }[];
  categoryPath: CategoryRef[];
  acceptsWhatsapp: boolean;
  favoriteCount: number | null;
};

export type SellerSummary = {
  id: string;
  name: string;
  displayName: string | null;
  avatar: ImageUrls | null;
  region: string | null;
  memberSince: string | null;
  isStore: boolean;
  storeVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
  activeListings: number;
  soldListings: number;
};

export type ListingPage = {
  listing: ListingDetail;
  seller: SellerSummary;
  viewer: { isOwner: boolean; isAdmin: boolean; isFavorite: boolean; conversationId: string | null };
  redirectSlug: string | null;
};

export type PublicProfile = {
  id: string;
  name: string;
  displayName: string;
  avatar: ImageUrls | null;
  region: string | null;
  bio: string | null;
  memberSince: string;
  isStore: boolean;
  store: { name: string | null; verified: boolean; address: string | null; phone: string | null; website: string | null; hours: string | null } | null;
  emailVerified: boolean;
  unavailable: boolean;
  stats: { ratingAvg: number; ratingCount: number; activeListings: number; soldListings: number };
};

export type Rating = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  raterId: string;
  raterName: string | null;
  listingTitle?: string | null;
  listingSlug?: string | null;
};

export type Me = {
  id: string;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
  displayName: string;
  avatar: ImageUrls | null;
  avatarKey: string | null;
  region: string | null;
  bio: string | null;
  role: "user" | "admin";
  status: "active" | "warned" | "restricted" | "suspended";
  statusUntil: string | null;
  phoneVerified: boolean;
  settings: Record<string, unknown>;
  createdAt: string;
  accountType: "personal" | "store";
  store: { name: string | null; verified: boolean; address: string | null; phone: string | null; website: string | null; hours: string | null };
  contact: { phone: string | null; whatsapp: boolean };
  counts: { active: number; pending: number; rejected: number; sold: number; inactive: number; favorites: number };
  rating: { avg: number; count: number };
};

export type MyListing = ListingCard & {
  rejectReason: string | null;
  favoriteCount: number | null;
  conversationCount: number;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationSummary = {
  id: string;
  role: "buyer" | "seller";
  lastMessageAt: string;
  createdAt: string;
  unread: number;
  lastMessage: { body: string | null; mine: boolean; createdAt: string } | null;
  other: { id: string; name: string | null; avatar: ImageUrls | null; isStore: boolean } | null;
  listing: { id: string; title: string; slug: string; price: number; currency: string; status: ListingStatus; image: ImageUrls | null } | null;
  meeting: { mine: boolean; theirs: boolean; confirmedAt: string | null };
  rated: boolean;
  iBlocked: boolean;
  blockedMe: boolean;
  canSend: boolean;
};

export type ChatMessage = { id: string; senderId: string | null; body: string; createdAt: string; readAt: string | null };

export type Notification = { id: string; kind: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export type UnreadCounts = { messages: number; notifications: number };

export type UploadResult = { key: string; kind: "listing" | "avatar"; width: number; height: number; urls: ImageUrls };

export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };
