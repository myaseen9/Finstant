import re

with open('prisma/schema.prisma', 'r') as f:
    content = f.read()

# Remove @@ignore
content = re.sub(r'\s*@@ignore', '', content)
# Remove the warning comment
content = re.sub(r'/// The underlying table does not contain a valid unique identifier and can therefore currently not be handled by Prisma Client\.\n', '', content)

with open('prisma/schema.prisma', 'w') as f:
    f.write(content)

print("Schema fixed!")
