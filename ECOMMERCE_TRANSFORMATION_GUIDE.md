# Suga N Spice - Full-Stack Ecommerce Transformation Guide

## Overview
This guide will transform your existing Next.js application into a complete full-stack ecommerce website using:
- **Stripe** for payment processing
- **Vercel** for deployment and hosting
- **Clerk** for authentication and user management
- **Prisma** for database management with **Supabase**
- **Supabase** for PostgreSQL database and additional backend services

## Current State Analysis
✅ **What you already have:**
- Next.js 15 with App Router
- ShadCN UI components
- Basic product catalog with empanadas, churros, and drinks
- Shopping cart functionality
- Responsive design with Tailwind CSS
- Product images and basic UI

❌ **What needs to be added:**
- User authentication (Clerk)
- Database integration (Prisma + Supabase)
- Payment processing (Stripe)
- Order management system
- User profiles and order history
- Admin dashboard
- API routes for backend functionality
- Production deployment (Vercel)

---

## Phase 1: Supabase Database Setup with Prisma

### Step 1.1: Set Up Supabase Project
1. Go to [Supabase](https://supabase.com) and create a new project
2. Choose a project name (e.g., "suga-n-spice-db")
3. Set a strong database password
4. Select a region close to your users
5. Wait for the project to be created (takes ~2 minutes)

### Step 1.2: Install Prisma and Database Dependencies
```bash
npm install prisma @prisma/client
npm install -D prisma
npx prisma init
```

### Step 1.3: Configure Database Schema for Supabase
Create/update `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  firstName String?
  lastName  String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  orders    Order[]
  
  @@map("users")
}

model Product {
  id          String   @id @default(cuid())
  name        String
  description String?
  price       Float    // Base price
  category    String
  image       String?
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  orderItems  OrderItem[]
  variants    ProductVariant[]
  
  @@map("products")
}

model ProductVariant {
  id        String  @id @default(cuid())
  productId String
  size      String  // e.g., "3 pieces", "5 pieces"
  price     Float
  
  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  @@unique([productId, size])
  @@map("product_variants")
}

model Order {
  id              String      @id @default(cuid())
  userId          String
  status          OrderStatus @default(PENDING)
  total           Float
  stripePaymentId String?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  user       User        @relation(fields: [userId], references: [id])
  orderItems OrderItem[]
  
  @@map("orders")
}

model OrderItem {
  id        String @id @default(cuid())
  orderId   String
  productId String
  quantity  Int
  price     Float
  
  order   Order   @relation(fields: [orderId], references: [id])
  product Product @relation(fields: [productId], references: [id])
  
  @@map("order_items")
}

enum OrderStatus {
  PENDING
  PROCESSING
  SHIPPED
  DELIVERED
  CANCELLED
}
```

### Step 1.4: Configure Environment Variables with Supabase
1. In your Supabase dashboard, go to **Settings > Database**
2. Copy the **Connection string** under "Connection pooling"
3. Update `.env.local`:

```env
# Supabase Database
DATABASE_URL="postgresql://postgres.your-project-ref:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# Supabase Additional (optional for direct client usage)
NEXT_PUBLIC_SUPABASE_URL="https://your-project-ref.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Clerk (will add in Phase 2)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=

# Stripe (will add in Phase 3)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

**Important**: Replace the placeholders with your actual Supabase credentials from the dashboard.

### Step 1.5: Generate Prisma Client and Push Schema to Supabase
```bash
npx prisma generate
npx prisma db push
```

**Note**: `prisma db push` will create the tables directly in your Supabase database. You can verify this by checking the **Table Editor** in your Supabase dashboard.

---

## Phase 2: Authentication with Clerk

### Step 2.1: Install Clerk
```bash
npm install @clerk/nextjs
```

### Step 2.2: Configure Clerk
Create `middleware.ts` in root directory:
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/profile(.*)',
  '/orders(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (isProtectedRoute(req)) auth().protect()
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

### Step 2.3: Update Layout
Update `app/layout.tsx`:
```typescript
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### Step 2.4: Create Authentication Components
Create `components/auth/sign-in-button.tsx`:
```typescript
'use client'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Button } from '../ui/button'

export function AuthButton() {
  return (
    <>
      <SignedOut>
        <SignInButton>
          <Button variant="outline">Sign In</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </>
  )
}
```

### Step 2.5: Create User Sync Webhook
Create `app/api/webhooks/clerk/route.ts`:
```typescript
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET to .env.local')
  }

  const headerPayload = headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400,
    })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)

  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Error verifying webhook:', err)
    return new Response('Error occured', {
      status: 400,
    })
  }

  if (evt.type === 'user.created') {
    await prisma.user.create({
      data: {
        clerkId: evt.data.id,
        email: evt.data.email_addresses[0].email_address,
        firstName: evt.data.first_name,
        lastName: evt.data.last_name,
      },
    })
  }

  return new Response('', { status: 200 })
}
```

---

## Phase 3: Stripe Payment Integration

### Step 3.1: Install Stripe
```bash
npm install stripe @stripe/stripe-js
npm install -D @types/stripe
```

### Step 3.2: Create Stripe Utilities
Create `lib/stripe.ts`:
```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})
```

Create `lib/stripe-client.ts`:
```typescript
import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
)
```

### Step 3.3: Create Checkout API Route
Create `app/api/checkout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: NextRequest) {
  try {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { items } = await req.json()

    // Create order in database
    const order = await prisma.order.create({
      data: {
        userId,
        total: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
        status: 'PENDING',
        orderItems: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
    })

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: items.map((item: any) => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      })),
      mode: 'payment',
      success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get('origin')}/`,
      metadata: {
        orderId: order.id,
      },
    })

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 3.4: Create Stripe Webhook Handler
Create `app/api/webhooks/stripe/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')!

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const orderId = session.metadata?.orderId

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'PROCESSING',
          stripePaymentId: session.payment_intent as string,
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}
```

### Step 3.5: Update Cart Component with Checkout
Create `components/checkout-button.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { Button } from './ui/button'
import { stripePromise } from '@/lib/stripe-client'

interface CheckoutButtonProps {
  items: any[]
  total: number
}

export function CheckoutButton({ items, total }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const { isSignedIn } = useAuth()

  const handleCheckout = async () => {
    if (!isSignedIn) {
      // Redirect to sign in
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      })

      const { sessionId } = await response.json()
      const stripe = await stripePromise
      
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId })
      }
    } catch (error) {
      console.error('Checkout error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      onClick={handleCheckout} 
      disabled={loading || items.length === 0}
      className="w-full"
    >
      {loading ? 'Processing...' : `Checkout - $${total.toFixed(2)}`}
    </Button>
  )
}
```

---

## Phase 4: Database Migration and Product Seeding

### Step 4.1: Create Product Seeding Script
Create `scripts/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const products = [
  {
    id: '1',
    name: 'Spicy Fiesta',
    description: 'Shrimp, Chickpeas, Cilantro, Peppers, Onions',
    price: 4,
    category: 'empanadas',
    image: '/empanadas-1.jpg'
  },
  {
    id: '2',
    name: 'Southwestern',
    description: 'Ground Beef, Potatoes, Cilantro, Olives',
    price: 3,
    category: 'empanadas',
    image: '/empanadas-1.jpg'
  },
  {
    id: '3',
    name: 'Mucho Queso',
    description: 'Quest Blanco',
    price: 3,
    category: 'empanadas',
    image: '/empanadas-1.jpg'
  },
  {
    id: '4',
    name: 'Plain Churros',
    description: 'All Churros can be dipped and stuffed $2 extra',
    price: 5, // Base price for 3 pieces
    category: 'churros',
    image: '/churros-1.jpg'
  },
  {
    id: '5',
    name: 'Dulce De Leche Stuffed',
    description: 'Sweet and creamy dulce de leche filling',
    price: 7, // Base price for 3 pieces
    category: 'churros',
    image: '/churros-1.jpg'
  },
  {
    id: '6',
    name: 'Iced Tea',
    description: 'Refreshing cold brew',
    price: 4,
    category: 'drinks',
    image: '/drinks-1.jpg'
  },
  {
    id: '7',
    name: 'Lemonade',
    description: 'Fresh squeezed',
    price: 4,
    category: 'drinks',
    image: '/drinks-1.jpg'
  },
  {
    id: '8',
    name: 'Passion Fruit',
    description: 'Tropical and sweet',
    price: 4,
    category: 'drinks',
    image: '/drinks-1.jpg'
  },
  {
    id: '9',
    name: 'Arnold Palmer',
    description: 'Half iced tea, half lemonade',
    price: 4,
    category: 'drinks',
    image: '/drinks-1.jpg'
  }
]

const productVariants = [
  // Plain Churros variants
  {
    productId: '4',
    size: '3 pieces',
    price: 5
  },
  {
    productId: '4',
    size: '5 pieces',
    price: 7
  },
  // Dulce De Leche Stuffed variants
  {
    productId: '5',
    size: '3 pieces',
    price: 7
  },
  {
    productId: '5',
    size: '5 pieces',
    price: 9
  }
]

async function main() {
  console.log('Seeding products...')
  
  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    })
  }
  
  console.log('Seeding product variants...')
  
  for (const variant of productVariants) {
    await prisma.productVariant.upsert({
      where: {
        productId_size: {
          productId: variant.productId,
          size: variant.size
        }
      },
      update: variant,
      create: variant,
    })
  }
  
  console.log('Products and variants seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

### Step 4.2: Add Seed Script to package.json
```json
{
  "scripts": {
    "seed": "tsx scripts/seed.ts"
  }
}
```

---

## Phase 5: Refactor Frontend to Use Database

### Step 5.1: Create Prisma Client Utility
Create `lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Step 5.2: Create Products API Route
Create `app/api/products/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function fetchProductsWithRetry(retries = 3): Promise<any[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const products = await prisma.product.findMany({
        where: { active: true },
        include: {
          variants: {
            orderBy: { price: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' },
      })
      return products
    } catch (error) {
      console.error(`Products fetch attempt ${i + 1} failed:`, error)
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
    }
  }
  throw new Error('Max retries exceeded')
}

export async function GET() {
  try {
    const products = await fetchProductsWithRetry()
    return NextResponse.json(products)
  } catch (error) {
    console.error('Products fetch error after retries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products. Please try again later.' }, 
      { status: 500 }
    )
  }
}
```

### Step 5.3: Update Main Page to Fetch from API
Update `app/page.tsx` to fetch products from the database instead of hardcoded data.

**CRITICAL: Preserve the exact UI design and cart functionality!**

Create `lib/types.ts` for shared types:
```typescript
export interface Product {
  id: string
  name: string
  description?: string
  price: number
  category: 'empanadas' | 'churros' | 'drinks'
  image?: string
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  productId: string
  size: string
  price: number
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  variant?: string // For churros sizes
}
```

Update `app/page.tsx` to fetch from API:
```typescript
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Plus, Minus, X } from 'lucide-react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Product, CartItem } from '@/lib/types'

// Loading component
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      <span className="ml-3 text-lg">Loading delicious items...</span>
    </div>
  )
}

// Error component
function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-red-500 text-lg mb-4">{message}</div>
      <Button onClick={onRetry} variant="outline">
        Try Again
      </Button>
    </div>
  )
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/products')
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      const data = await response.json()
      setProducts(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  // Rest of your existing cart logic remains exactly the same
  const addToCart = (product: Product) => {
    const variant = product.variants?.length ? selectedVariants[product.id] : undefined
    const selectedVariantData = product.variants?.find(v => v.size === variant)
    const price = selectedVariantData?.price || product.price
    const itemName = variant ? `${product.name} (${variant})` : product.name
    
    setCart(prev => {
      const existingItem = prev.find(item => 
        item.id === product.id && item.variant === variant
      )
      
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id && item.variant === variant
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      
      return [...prev, {
        id: product.id,
        name: itemName,
        price,
        quantity: 1,
        variant
      }]
    })
  }

  // Keep all your existing cart functions (updateQuantity, removeFromCart, etc.)
  // ... (rest of your existing component logic)

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} onRetry={fetchProducts} />

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* Keep your exact existing JSX structure */}
      {/* Just replace the hardcoded products with the fetched products */}
      {/* All your existing styling and layout remains unchanged */}
    </div>
  )
}
```

### Step 5.4: Create Success and Cancel Pages

Create `app/success/page.tsx`:
```typescript
import { Suspense } from 'react'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

function SuccessContent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-800">Order Confirmed!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Thank you for your order! We've received your payment and will start preparing your delicious items.
          </p>
          <p className="text-sm text-gray-500">
            You'll receive an email confirmation shortly with your order details.
          </p>
          <div className="space-y-2">
            <Link href="/dashboard">
              <Button className="w-full">
                View Order Status
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessContent />
    </Suspense>
  )
}
```

Create `app/cancel/page.tsx`:
```typescript
import { XCircle, ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-800">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            Your payment was cancelled. No charges were made to your account.
          </p>
          <p className="text-sm text-gray-500">
            Your cart items are still saved and ready for checkout when you're ready.
          </p>
          <div className="space-y-2">
            <Link href="/">
              <Button className="w-full">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Return to Cart
              </Button>
            </Link>
            <Link href="/">
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Phase 6: User Dashboard and Order Management

### Step 6.1: Create User Dashboard
Create `app/dashboard/page.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export default async function Dashboard() {
  const { userId } = auth()
  
  if (!userId) {
    redirect('/sign-in')
  }

  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      orders: {
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Dashboard</h1>
      
      <div className="grid gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
          {user?.orders.map((order) => (
            <div key={order.id} className="border rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium">Order #{order.id.slice(-8)}</span>
                <span className="text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                Status: {order.status}
              </div>
              <div className="font-semibold">
                Total: ${order.total.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Phase 7: Admin Dashboard & Product Management

### Step 7.1: Create Admin Layout
Create `app/admin/layout.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Package, ShoppingBag, Users, BarChart3 } from 'lucide-react'

// Admin user check - replace with your Clerk user ID
const ADMIN_USER_IDS = ['your-clerk-user-id'] // Add your Clerk user ID here

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link href="/admin" className="text-xl font-bold text-orange-600">
                Suga N Spice Admin
              </Link>
              <div className="flex space-x-4">
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Dashboard
                  </Button>
                </Link>
                <Link href="/admin/products">
                  <Button variant="ghost" size="sm">
                    <Package className="w-4 h-4 mr-2" />
                    Products
                  </Button>
                </Link>
                <Link href="/admin/orders">
                  <Button variant="ghost" size="sm">
                    <ShoppingBag className="w-4 h-4 mr-2" />
                    Orders
                  </Button>
                </Link>
                <Link href="/admin/users">
                  <Button variant="ghost" size="sm">
                    <Users className="w-4 h-4 mr-2" />
                    Users
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <Link href="/">
                <Button variant="outline" size="sm">
                  View Store
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
```

### Step 7.2: Admin Dashboard Overview
Create `app/admin/page.tsx`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Package, ShoppingBag, Users, DollarSign } from 'lucide-react'

export default async function AdminDashboard() {
  const { userId } = auth()
  
  // Fetch dashboard stats
  const [productCount, orderCount, userCount, totalRevenue] = await Promise.all([
    prisma.product.count({ where: { active: true } }),
    prisma.order.count(),
    prisma.user.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: 'COMPLETED' }
    })
  ])

  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      items: { include: { product: true } }
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{productCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(totalRevenue._sum.total || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">
                    Order #{order.id.slice(-8)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {order.user.firstName} {order.user.lastName} • {order.items.length} items
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${order.total.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">{order.status}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 7.3: Product Management
Create `app/admin/products/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Edit, Trash2, Eye } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Product, ProductVariant } from '@/lib/types'

interface ProductWithVariants extends Product {
  variants: ProductVariant[]
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductWithVariants[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/admin/products')
      const data = await response.json()
      setProducts(data)
    } catch (error) {
      console.error('Failed to fetch products:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        setProducts(products.filter(p => p.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete product:', error)
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading products...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Product Management</h1>
        <Link href="/admin/products/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        {products.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                {product.image && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden">
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{product.name}</h3>
                      <p className="text-gray-600 text-sm">{product.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="secondary">{product.category}</Badge>
                        <span className="text-lg font-bold">${product.price}</span>
                      </div>
                      {product.variants.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-500">Variants:</p>
                          <div className="flex space-x-2 mt-1">
                            {product.variants.map((variant) => (
                              <Badge key={variant.id} variant="outline">
                                {variant.size}: ${variant.price}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Link href={`/admin/products/${product.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/products/${product.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => deleteProduct(product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### Step 7.4: Admin API Routes
Create `app/api/admin/products/route.ts`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_USER_IDS = ['your-clerk-user-id'] // Add your Clerk user ID

export async function GET() {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const products = await prisma.product.findMany({
      include: {
        variants: {
          orderBy: { price: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json(products)
  } catch (error) {
    console.error('Admin products fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' }, 
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, description, price, category, image, variants } = body
    
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        image,
        variants: {
          create: variants?.map((v: any) => ({
            size: v.size,
            price: parseFloat(v.price)
          })) || []
        }
      },
      include: {
        variants: true
      }
    })
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Product creation error:', error)
    return NextResponse.json(
      { error: 'Failed to create product' }, 
      { status: 500 }
    )
  }
}
```

Create `app/api/admin/products/[id]/route.ts`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_USER_IDS = ['your-clerk-user-id']

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: {
        variants: {
          orderBy: { price: 'asc' }
        }
      }
    })
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Product fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' }, 
      { status: 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { name, description, price, category, image, variants } = body
    
    // Delete existing variants and create new ones
    await prisma.productVariant.deleteMany({
      where: { productId: params.id }
    })
    
    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name,
        description,
        price: parseFloat(price),
        category,
        image,
        variants: {
          create: variants?.map((v: any) => ({
            size: v.size,
            price: parseFloat(v.price)
          })) || []
        }
      },
      include: {
        variants: true
      }
    })
    
    return NextResponse.json(product)
  } catch (error) {
    console.error('Product update error:', error)
    return NextResponse.json(
      { error: 'Failed to update product' }, 
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.product.delete({
      where: { id: params.id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Product deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete product' }, 
      { status: 500 }
    )
  }
}
```

### Step 7.5: Order Management
Create `app/admin/orders/page.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye } from 'lucide-react'

interface Order {
  id: string
  total: number
  status: string
  createdAt: string
  user: {
    firstName: string
    lastName: string
    email: string
  }
  items: {
    id: string
    quantity: number
    price: number
    product: {
      name: string
    }
  }[]
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
  }, [])

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/admin/orders')
      const data = await response.json()
      setOrders(data)
    } catch (error) {
      console.error('Failed to fetch orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      
      if (response.ok) {
        setOrders(orders.map(order => 
          order.id === orderId ? { ...order, status } : order
        ))
      }
    } catch (error) {
      console.error('Failed to update order status:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'PROCESSING': return 'bg-blue-100 text-blue-800'
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading orders...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Order Management</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold">
                      Order #{order.id.slice(-8)}
                    </h3>
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                  <p className="text-gray-600">
                    {order.user.firstName} {order.user.lastName} • {order.user.email}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                  <div className="space-y-1">
                    {order.items.map((item) => (
                      <p key={item.id} className="text-sm">
                        {item.quantity}x {item.product.name} - ${item.price.toFixed(2)}
                      </p>
                    ))}
                  </div>
                  <p className="font-bold text-lg">
                    Total: ${order.total.toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Select
                    value={order.status}
                    onValueChange={(status) => updateOrderStatus(order.id, status)}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="PROCESSING">Processing</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

Create `app/api/admin/orders/route.ts`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_USER_IDS = ['your-clerk-user-id']

export async function GET() {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const orders = await prisma.order.findMany({
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json(orders)
  } catch (error) {
    console.error('Admin orders fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' }, 
      { status: 500 }
    )
  }
}
```

Create `app/api/admin/orders/[id]/route.ts`:
```typescript
import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const ADMIN_USER_IDS = ['your-clerk-user-id']

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { userId } = auth()
  
  if (!userId || !ADMIN_USER_IDS.includes(userId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { status } = await req.json()
    
    const order = await prisma.order.update({
      where: { id: params.id },
      data: { status },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })
    
    return NextResponse.json(order)
  } catch (error) {
    console.error('Order update error:', error)
    return NextResponse.json(
      { error: 'Failed to update order' }, 
      { status: 500 }
    )
  }
}
```

---

## Phase 8: Vercel Deployment

### Step 7.1: Environment Variables Setup
In Vercel dashboard, add all environment variables:
- `DATABASE_URL` (Supabase connection string with pooling)
- `NEXT_PUBLIC_SUPABASE_URL` (optional)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional)
- `SUPABASE_SERVICE_ROLE_KEY` (optional)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Step 7.2: Supabase Production Database Setup
1. Your Supabase database is already production-ready
2. In Vercel dashboard, add your Supabase `DATABASE_URL` to environment variables
3. The connection string should use connection pooling for production:
   ```
   DATABASE_URL="postgresql://postgres.your-project-ref:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
   ```
4. Run migrations in production: `npx prisma db push`
5. Seed production database: `npm run seed`

### Step 7.3: Webhook Configuration
1. **Clerk Webhooks**: Add Vercel URL to Clerk dashboard
   - Endpoint: `https://your-domain.vercel.app/api/webhooks/clerk`
   - Events: `user.created`, `user.updated`

2. **Stripe Webhooks**: Add Vercel URL to Stripe dashboard
   - Endpoint: `https://your-domain.vercel.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`

### Step 7.4: Deploy to Vercel
```bash
npm install -g vercel
vercel --prod
```

---

## Phase 9: Testing and Optimization

### Step 9.1: Testing Checklist
- [ ] User registration and login
- [ ] Product browsing and cart functionality
- [ ] Checkout process with Stripe
- [ ] Order confirmation and status updates
- [ ] User dashboard and order history
- [ ] Webhook functionality (Clerk and Stripe)
- [ ] Mobile responsiveness
- [ ] Performance optimization

### Step 9.2: Performance Optimizations
- Implement image optimization with Next.js Image component
- Add loading states and error handling
- Implement caching strategies
- Optimize database queries
- Add SEO meta tags

### Step 9.3: Security Considerations
- Validate all user inputs
- Implement rate limiting
- Secure API routes with proper authentication
- Use HTTPS in production
- Implement CORS policies

---

## Phase 10: Additional Features (Optional)

### Step 10.1: Admin Dashboard
- Product management (CRUD operations)
- Order management
- User management
- Analytics and reporting

### Step 10.2: Advanced Features
- Email notifications (using Resend or SendGrid)
- Inventory management
- Discount codes and promotions
- Customer reviews and ratings
- Search and filtering
- Wishlist functionality

---

## Deployment Commands Summary

```bash
# Development
npm run dev

# Database operations
npx prisma generate
npx prisma db push
npm run seed

# Production deployment
vercel --prod
```

## Key Files to Create/Modify

### New Files:
- `prisma/schema.prisma`
- `middleware.ts`
- `lib/prisma.ts`
- `lib/stripe.ts`
- `lib/stripe-client.ts`
- `scripts/seed.ts`
- `app/api/products/route.ts`
- `app/api/checkout/route.ts`
- `app/api/webhooks/clerk/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/dashboard/page.tsx`
- `components/auth/sign-in-button.tsx`
- `components/checkout-button.tsx`

### Modified Files:
- `app/layout.tsx`
- `app/page.tsx`
- `package.json`
- `.env.local`

---

## Support and Troubleshooting

### Common Issues:
1. **Database Connection**: Ensure DATABASE_URL is correct
2. **Webhook Failures**: Check endpoint URLs and secrets
3. **Stripe Integration**: Verify API keys and webhook configuration
4. **Clerk Authentication**: Ensure middleware is properly configured

### Resources:
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

---

**Next Steps**: Start with Phase 1 (Database Setup) and work through each phase systematically. Test thoroughly at each phase before moving to the next one.
