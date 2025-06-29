'use client';
import React, { useState } from 'react';
import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
// Import images from public directory
const churrosImage = '/churros-1.jpg';
const churrosPlateImage = '/churros-2.jpg'; // Note: using churros-2.jpg as churros-plate.jpg doesn't exist
const empanadaImage = '/empanadas-1.jpg'; // Note: corrected filename
const drinksImage = '/drinks-1.jpg';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: 'empanadas' | 'churros' | 'drinks';
  options?: { size: string; price: number }[];
}

interface CartItem {
  product: Product;
  quantity: number;
  selectedOption?: string;
  price: number;
}

const products: Product[] = [
  {
    id: '1',
    name: 'Spicy Fiesta',
    description: 'Shrimp, Chickpeas, Cilantro, Peppers, Onions',
    price: 4,
    category: 'empanadas'
  },
  {
    id: '2',
    name: 'Southwestern',
    description: 'Ground Beef, Potatoes, Cilantro, Olives',
    price: 3,
    category: 'empanadas'
  },
  {
    id: '3',
    name: 'Mucho Queso',
    description: 'Quest Blanco',
    price: 3,
    category: 'empanadas'
  },
  {
    id: '4',
    name: 'Plain Churros',
    description: 'All Churros can be dipped and stuffed $2 extra',
    price: 5,
    category: 'churros',
    options: [
      { size: '3 pieces', price: 5 },
      { size: '5 pieces', price: 7 }
    ]
  },
  {
    id: '5',
    name: 'Dulce De Leche Stuffed',
    description: 'Sweet and creamy dulce de leche filling',
    price: 7,
    category: 'churros',
    options: [
      { size: '3 pieces', price: 7 },
      { size: '5 pieces', price: 9 }
    ]
  },
  {
    id: '6',
    name: 'Iced Tea',
    description: 'Refreshing cold brew',
    price: 4,
    category: 'drinks'
  },
  {
    id: '7',
    name: 'Lemonade',
    description: 'Fresh squeezed',
    price: 4,
    category: 'drinks'
  },
  {
    id: '8',
    name: 'Passion Fruit',
    description: 'Tropical and sweet',
    price: 4,
    category: 'drinks'
  },
  {
    id: '9',
    name: 'Arnold Palmer',
    description: 'Half iced tea, half lemonade',
    price: 4,
    category: 'drinks'
  }
];

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const addToCart = (product: Product, selectedOption?: string) => {
    const price = selectedOption 
      ? product.options?.find(opt => opt.size === selectedOption)?.price || product.price
      : product.price;

    setCart(prevCart => {
      const existingItem = prevCart.find(
        item => item.product.id === product.id && item.selectedOption === selectedOption
      );

      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id && item.selectedOption === selectedOption
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prevCart, { product, quantity: 1, selectedOption, price }];
    });
  };

  const updateQuantity = (productId: string, selectedOption: string | undefined, newQuantity: number) => {
    if (newQuantity === 0) {
      setCart(prevCart => 
        prevCart.filter(item => 
          !(item.product.id === productId && item.selectedOption === selectedOption)
        )
      );
    } else {
      setCart(prevCart =>
        prevCart.map(item =>
          item.product.id === productId && item.selectedOption === selectedOption
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    }
  };

  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);
  const getTotalPrice = () => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const ProductCard = ({ product }: { product: Product }) => {
    const [selectedOption, setSelectedOption] = useState<string>(
      product.options ? product.options[0].size : ''
    );

    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-brand-brown">{product.name}</CardTitle>
          {product.description && (
            <p className="text-sm text-muted-foreground">{product.description}</p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {product.options ? (
              <div className="space-y-2">
                {product.options.map((option) => (
                  <div key={option.size} className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`${product.id}-size`}
                        value={option.size}
                        checked={selectedOption === option.size}
                        onChange={(e) => setSelectedOption(e.target.value)}
                        className="text-brand-orange"
                      />
                      <span>{option.size}</span>
                    </label>
                    <Badge variant="secondary" className="bg-brand-yellow text-brand-brown">
                      ${option.price}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <Badge variant="secondary" className="bg-brand-yellow text-brand-brown">
                ${product.price}
              </Badge>
            )}
            <Button 
              onClick={() => addToCart(product, selectedOption || undefined)}
              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white"
            >
              Add to Cart
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-yellow via-white to-brand-green/20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-brand-orange/20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand-brown">SUGA &amp; SPICE</h1>
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative border-brand-orange text-brand-brown hover:bg-brand-orange hover:text-white">
                <ShoppingCart className="h-4 w-4" />
                {getTotalItems() > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-brand-pink text-xs text-white p-0 flex items-center justify-center">
                    {getTotalItems()}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Shopping Cart</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {cart.length === 0 ? (
                  <p className="text-muted-foreground">Your cart is empty</p>
                ) : (
                  <>
                    {cart.map((item, index) => (
                      <div key={`${item.product.id}-${item.selectedOption}-${index}`} className="flex items-center justify-between space-x-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product.name}</p>
                          {item.selectedOption && (
                            <p className="text-sm text-muted-foreground">{item.selectedOption}</p>
                          )}
                          <p className="text-sm text-brand-brown">${item.price}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, item.selectedOption, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateQuantity(item.product.id, item.selectedOption, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span>Total: ${getTotalPrice().toFixed(2)}</span>
                      <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                        <DialogTrigger asChild>
                          <Button className="bg-brand-orange hover:bg-brand-orange/90 text-white">
                            Checkout
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Checkout</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="name">Name</Label>
                              <Input id="name" placeholder="Your name" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="phone">Phone</Label>
                              <Input id="phone" placeholder="Your phone number" />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="email">Email</Label>
                              <Input id="email" placeholder="Your email" />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <h4>Order Summary</h4>
                              {cart.map((item, index) => (
                                <div key={`checkout-${item.product.id}-${item.selectedOption}-${index}`} className="flex justify-between text-sm">
                                  <span>{item.product.name} {item.selectedOption && `(${item.selectedOption})`} x{item.quantity}</span>
                                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between pt-2 border-t">
                                <span>Total:</span>
                                <span>${getTotalPrice().toFixed(2)}</span>
                              </div>
                            </div>
                            <Button 
                              className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white"
                              onClick={() => {
                                alert('Order placed successfully! We will contact you shortly.');
                                setCart([]);
                                setIsCheckoutOpen(false);
                                setIsCartOpen(false);
                              }}
                            >
                              Place Order
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        {/* Hero Section */}
        <section className="text-center space-y-6 py-8">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold text-brand-brown">Welcome to Suga &amp; Spice</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Delicious empanadas, fresh churros, and refreshing drinks made with love. 
              Order now for pickup or delivery!
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur rounded-lg p-6 border border-brand-orange/20 shadow-sm">
              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 border-2 border-brand-orange">
                <img 
                  src={empanadaImage} 
                  alt="Fresh Empanadas" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-bold text-brand-brown mb-2">Fresh Empanadas</h3>
              <p className="text-sm text-muted-foreground">Handmade with authentic flavors and premium ingredients</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-lg p-6 border border-brand-orange/20 shadow-sm">
              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 border-2 border-brand-orange">
                <img 
                  src={churrosImage} 
                  alt="Fresh Churros" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-bold text-brand-brown mb-2">Crispy Churros</h3>
              <p className="text-sm text-muted-foreground">Golden and crispy, perfect for dipping or stuffing</p>
            </div>
            <div className="bg-white/80 backdrop-blur rounded-lg p-6 border border-brand-orange/20 shadow-sm">
              <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4 border-2 border-brand-orange">
                <img 
                  src={drinksImage} 
                  alt="Fresh Drinks" 
                  className="w-full h-full object-cover"
                />
              </div>
              <h3 className="font-bold text-brand-brown mb-2">Fresh Drinks</h3>
              <p className="text-sm text-muted-foreground">Refreshing beverages to complement your meal</p>
            </div>
          </div>
        </section>

        {/* Empanadas Section */}
        <section>
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="md:w-1/3">
              <img 
                src={empanadaImage} 
                alt="Delicious Empanadas" 
                className="w-full h-64 md:h-80 object-cover rounded-lg shadow-lg border border-brand-orange/20"
              />
            </div>
            <div className="md:w-2/3 flex flex-col justify-center space-y-4">
              <h2 className="text-3xl font-bold text-brand-brown">Handcrafted Empanadas</h2>
              <p className="text-lg text-muted-foreground">
                Our empanadas are handmade daily with fresh ingredients and authentic recipes. 
                Each one is carefully folded and baked to golden perfection with crispy edges and flavorful fillings.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-brand-yellow text-brand-brown">Handmade Daily</Badge>
                <Badge className="bg-brand-pink text-white">Authentic Recipes</Badge>
                <Badge className="bg-brand-green text-brand-brown">Fresh Ingredients</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.filter(p => p.category === 'empanadas').map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* Churros Section */}
        <section>
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="md:w-1/3">
              <img 
                src={churrosPlateImage} 
                alt="Delicious Churros" 
                className="w-full h-64 md:h-80 object-cover rounded-lg shadow-lg border border-brand-orange/20"
              />
            </div>
            <div className="md:w-2/3 flex flex-col justify-center space-y-4">
              <h2 className="text-3xl font-bold text-brand-brown">Fresh Churros</h2>
              <p className="text-lg text-muted-foreground">
                Our churros are made fresh daily, crispy on the outside and soft on the inside. 
                Dusted with cinnamon sugar and served with your choice of dipping sauces. Perfect with coffee!
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-brand-yellow text-brand-brown">Made Fresh Daily</Badge>
                <Badge className="bg-brand-pink text-white">Cinnamon Sugar</Badge>
                <Badge className="bg-brand-green text-brand-brown">Dipping Sauces Available</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.filter(p => p.category === 'churros').map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>

        {/* Drinks Section */}
        <section>
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            <div className="md:w-1/3">
              <img 
                src={drinksImage} 
                alt="Refreshing Drinks" 
                className="w-full h-64 md:h-80 object-cover rounded-lg shadow-lg border border-brand-orange/20"
              />
            </div>
            <div className="md:w-2/3 flex flex-col justify-center space-y-4">
              <h2 className="text-3xl font-bold text-brand-brown">Refreshing Beverages</h2>
              <p className="text-lg text-muted-foreground">
                Cool down with our selection of fresh beverages made with real fruit and premium ingredients. 
                From classic iced tea to tropical passion fruit, we have the perfect drink to complement your meal.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-brand-yellow text-brand-brown">Real Fruit</Badge>
                <Badge className="bg-brand-pink text-white">Fresh Daily</Badge>
                <Badge className="bg-brand-green text-brand-brown">Premium Ingredients</Badge>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.filter(p => p.category === 'drinks').map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-brand-brown text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center space-y-4">
          <h3 className="text-xl font-bold">SUGA &amp; SPICE</h3>
          <p className="text-sm opacity-90">
            Follow us for updates and special offers!
          </p>
          <p className="text-xs opacity-75">
            © 2025 Suga &amp; Spice. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}