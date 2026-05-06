with open("gateway/src/index.ts", "r") as f:
    content = f.read()

import_statement = "import { failSafeMiddleware } from './middleware/failSafe.js';\n"
if "failSafeMiddleware" not in content:
    content = content.replace("import adminEmailRoutes from './routes/adminEmail.js';", "import adminEmailRoutes from './routes/adminEmail.js';\n" + import_statement)
    content = content.replace("app.use(\n  '/api/*',\n  cors({", "app.use('*', failSafeMiddleware);\n\napp.use(\n  '/api/*',\n  cors({")

with open("gateway/src/index.ts", "w") as f:
    f.write(content)
