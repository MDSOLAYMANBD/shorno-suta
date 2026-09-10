import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trackAddToCart, trackRemoveFromCart } from '@/lib/ecommerceTracking';
import { trackVisitorActivity } from '@/hooks/useVisitorTracking';

export interface CartItem {
  id: string;
  name: string;
  name_bn: string;
  price: number;
  original_price?: number;
  image: string;
  quantity: number;
  size?: string;
  color?: string;
  slug: string;
  is_addon?: boolean;
  parent_product_id?: string;
  instance_id?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (id: string, size?: string, color?: string, instanceId?: string) => void;
  updateQuantity: (id: string, quantity: number, size?: string, color?: string, instanceId?: string) => void;
  updateItemSize: (id: string, oldSize: string | undefined, color: string | undefined, newSize: string, newPrice?: number, newOriginalPrice?: number, instanceId?: string) => void;
  updateItemColor: (id: string, size: string | undefined, oldColor: string | undefined, newColor: string, newImage?: string, newPrice?: number, instanceId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const getCartKey = (id: string, size?: string, color?: string, instanceId?: string) =>
  `${id}-${size || ''}-${color || ''}-${instanceId || ''}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem('shorno-suta-cart');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('shorno-suta-cart', JSON.stringify(items));
  }, [items]);

  const addItem = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems(prev => {
      // If instance_id provided, always create a new row (never merge)
      if (item.instance_id) {
        return [...prev, { ...item, quantity }];
      }
      const key = getCartKey(item.id, item.size, item.color, undefined);
      const existing = prev.find(i => !i.instance_id && getCartKey(i.id, i.size, i.color, undefined) === key);
      if (existing) {
        return prev.map(i =>
          !i.instance_id && getCartKey(i.id, i.size, i.color, undefined) === key
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
    trackAddToCart(item, quantity);
    trackVisitorActivity('add_to_cart', item.id, item.name, { size: item.size, color: item.color, quantity });
  };

  const removeItem = (id: string, size?: string, color?: string, instanceId?: string) => {
    const key = getCartKey(id, size, color, instanceId);
    const item = items.find(i => getCartKey(i.id, i.size, i.color, i.instance_id) === key);
    if (item) trackRemoveFromCart(item, item.quantity);
    setItems(prev => prev.filter(i => getCartKey(i.id, i.size, i.color, i.instance_id) !== key));
  };

  const updateQuantity = (id: string, quantity: number, size?: string, color?: string, instanceId?: string) => {
    if (quantity <= 0) return removeItem(id, size, color, instanceId);
    const key = getCartKey(id, size, color, instanceId);
    setItems(prev => prev.map(i =>
      getCartKey(i.id, i.size, i.color, i.instance_id) === key ? { ...i, quantity } : i
    ));
  };

  const updateItemSize = (id: string, oldSize: string | undefined, color: string | undefined, newSize: string, newPrice?: number, newOriginalPrice?: number, instanceId?: string) => {
    const oldKey = getCartKey(id, oldSize, color, instanceId);
    const newKey = getCartKey(id, newSize, color, instanceId);
    if (oldKey === newKey) return;
    setItems(prev => {
      const oldItem = prev.find(i => getCartKey(i.id, i.size, i.color, i.instance_id) === oldKey);
      if (!oldItem) return prev;
      // If this item has an instance_id, never merge — just rename
      if (instanceId) {
        return prev.map(i => getCartKey(i.id, i.size, i.color, i.instance_id) === oldKey ? { ...i, size: newSize, price: newPrice ?? i.price, original_price: newOriginalPrice !== undefined ? newOriginalPrice : i.original_price } : i);
      }
      const existingNew = prev.find(i => !i.instance_id && getCartKey(i.id, i.size, i.color, undefined) === newKey);
      if (existingNew) {
        return prev
          .filter(i => getCartKey(i.id, i.size, i.color, i.instance_id) !== oldKey)
          .map(i => !i.instance_id && getCartKey(i.id, i.size, i.color, undefined) === newKey ? { ...i, quantity: i.quantity + oldItem.quantity } : i);
      }
      return prev.map(i => getCartKey(i.id, i.size, i.color, i.instance_id) === oldKey ? { ...i, size: newSize, price: newPrice ?? i.price, original_price: newOriginalPrice !== undefined ? newOriginalPrice : i.original_price } : i);
    });
  };

  const updateItemColor = (id: string, size: string | undefined, oldColor: string | undefined, newColor: string, newImage?: string, newPrice?: number, instanceId?: string) => {
    const oldKey = getCartKey(id, size, oldColor, instanceId);
    const newKey = getCartKey(id, size, newColor, instanceId);
    if (oldKey === newKey) return;
    setItems(prev => {
      const oldItem = prev.find(i => getCartKey(i.id, i.size, i.color, i.instance_id) === oldKey);
      if (!oldItem) return prev;
      if (instanceId) {
        return prev.map(i => getCartKey(i.id, i.size, i.color, i.instance_id) === oldKey
          ? { ...i, color: newColor, image: newImage ?? i.image, price: newPrice ?? i.price }
          : i
        );
      }
      const existingNew = prev.find(i => !i.instance_id && getCartKey(i.id, i.size, i.color, undefined) === newKey);
      if (existingNew) {
        return prev
          .filter(i => getCartKey(i.id, i.size, i.color, i.instance_id) !== oldKey)
          .map(i => !i.instance_id && getCartKey(i.id, i.size, i.color, undefined) === newKey ? { ...i, quantity: i.quantity + oldItem.quantity } : i);
      }
      return prev.map(i => getCartKey(i.id, i.size, i.color, i.instance_id) === oldKey
        ? { ...i, color: newColor, image: newImage ?? i.image, price: newPrice ?? i.price }
        : i
      );
    });
  };

  const clearCart = () => setItems([]);
  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, updateItemSize, updateItemColor, clearCart, totalItems, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
