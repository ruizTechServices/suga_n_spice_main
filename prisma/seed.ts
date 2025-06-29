import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Create products
  const empanadas = await prisma.product.upsert({
    where: { id: 'empanadas' },
    update: {},
    create: {
      id: 'empanadas',
      name: 'Empanadas',
      description: 'Delicious handmade empanadas with various fillings',
      image: '/empanadas.jpg',
      category: 'food',
      variants: {
        create: [
          { name: 'Beef', price: 3.50 },
          { name: 'Chicken', price: 3.50 },
          { name: 'Cheese', price: 3.00 },
          { name: 'Spinach & Cheese', price: 3.25 },
        ]
      }
    },
  })

  const churros = await prisma.product.upsert({
    where: { id: 'churros' },
    update: {},
    create: {
      id: 'churros',
      name: 'Churros',
      description: 'Fresh churros with cinnamon sugar',
      image: '/churros.jpg',
      category: 'dessert',
      variants: {
        create: [
          { name: '3 pieces', price: 6.00 },
          { name: '5 pieces plain', price: 9.00 },
          { name: '5 pieces dulce de leche stuffed', price: 12.00 },
        ]
      }
    },
  })

  const drinks = await prisma.product.upsert({
    where: { id: 'drinks' },
    update: {},
    create: {
      id: 'drinks',
      name: 'Latin Drinks',
      description: 'Authentic Latin beverages',
      image: '/drinks.jpg',
      category: 'beverage',
      variants: {
        create: [
          { name: 'Horchata', price: 4.00 },
          { name: 'Jamaica (Hibiscus)', price: 3.50 },
          { name: 'Tamarindo', price: 3.50 },
          { name: 'Agua Fresca', price: 3.00 },
        ]
      }
    },
  })

  console.log('✅ Database seeded successfully!')
  console.log({ empanadas, churros, drinks })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
