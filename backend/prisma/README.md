# Generate Prisma client after schema changes
prisma generate

# Create a new migration
prisma migrate dev --name description_of_changes

# View database in Prisma Studio
prisma studio

# Reset database (CAUTION: deletes all data)
prisma migrate reset

