import { Supplier, SupplierContact } from '../types.ts';

const LEGAL_SUFFIXES = /\b(pty|ltd|limited|proprietary|p\s*l|pl|australia|australian)\b/g;

export const canonicalSupplierName = (name: string): string => (
  name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(LEGAL_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const normalizedEmail = (email?: string) => (email || '').trim().toLowerCase();

const contactKey = (contact: SupplierContact) => {
  const email = normalizedEmail(contact.email);
  if (email) return `email:${email}`;
  return `name:${contact.name.trim().toLowerCase()}|phone:${(contact.phone || '').trim()}`;
};

const cleanContact = (contact: SupplierContact): SupplierContact | null => {
  const name = contact.name.trim();
  const email = normalizedEmail(contact.email);
  const phone = (contact.phone || '').trim();
  const role = (contact.role || '').trim();
  if (!name && !email && !phone) return null;

  return {
    id: contact.id || `contact-${email || `${name}-${phone}`.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
    name,
    email,
    phone,
    role,
    isPrimary: Boolean(contact.isPrimary)
  };
};

export const normalizeSupplierContacts = (supplier: Pick<Supplier, 'contacts' | 'keyContact' | 'contactEmail' | 'phone'>): SupplierContact[] => {
  const contacts: SupplierContact[] = [];
  const legacyContact = cleanContact({
    id: 'primary-contact',
    name: supplier.keyContact || '',
    email: supplier.contactEmail || '',
    phone: supplier.phone || '',
    role: 'Primary contact',
    isPrimary: true
  });

  if (legacyContact) contacts.push(legacyContact);
  (supplier.contacts || []).forEach(contact => {
    const cleaned = cleanContact(contact);
    if (cleaned) contacts.push(cleaned);
  });

  const deduped = new Map<string, SupplierContact>();
  contacts.forEach(contact => {
    const key = contactKey(contact);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, contact);
      return;
    }
    deduped.set(key, {
      ...existing,
      name: existing.name || contact.name,
      email: existing.email || contact.email,
      phone: existing.phone || contact.phone,
      role: existing.role || contact.role,
      isPrimary: existing.isPrimary || contact.isPrimary
    });
  });

  const result = Array.from(deduped.values());
  if (result.length > 0 && !result.some(contact => contact.isPrimary)) {
    result[0] = { ...result[0], isPrimary: true };
  }
  return result;
};

export const mergeSupplierRecords = (primary: Supplier, duplicate: Supplier): Supplier => {
  const contacts = normalizeSupplierContacts({
    ...primary,
    contacts: [
      ...(primary.contacts || []),
      ...(duplicate.contacts || []),
      {
        id: `legacy-${duplicate.id}`,
        name: duplicate.keyContact || '',
        email: duplicate.contactEmail || '',
        phone: duplicate.phone || '',
        role: 'Supplier contact',
        isPrimary: false
      }
    ]
  });
  const primaryContact = contacts.find(contact => contact.isPrimary) || contacts[0];

  return {
    ...primary,
    name: primary.name || duplicate.name,
    keyContact: primary.keyContact || primaryContact?.name || duplicate.keyContact,
    contactEmail: primary.contactEmail || primaryContact?.email || duplicate.contactEmail,
    phone: primary.phone || primaryContact?.phone || duplicate.phone,
    address: primary.address || duplicate.address,
    categories: Array.from(new Set([...(primary.categories || []), ...(duplicate.categories || [])].filter(Boolean))),
    contacts
  };
};

export const dedupeSuppliersForDisplay = (suppliers: Supplier[]): Supplier[] => {
  const byName = new Map<string, Supplier>();

  suppliers.forEach(supplier => {
    const key = canonicalSupplierName(supplier.name);
    if (!key) return;

    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...supplier, contacts: normalizeSupplierContacts(supplier) });
      return;
    }
    byName.set(key, mergeSupplierRecords(existing, supplier));
  });

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const findSupplierByContactEmail = (suppliers: Supplier[], email?: string): Supplier | undefined => {
  const normalized = normalizedEmail(email);
  if (!normalized) return undefined;
  return suppliers.find(supplier => normalizeSupplierContacts(supplier).some(contact => normalizedEmail(contact.email) === normalized));
};
