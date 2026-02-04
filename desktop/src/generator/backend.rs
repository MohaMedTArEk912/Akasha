//! Backend Code Generator
//! 
//! Generates NestJS + Prisma code from API schemas and logic flows.

use crate::schema::{ProjectSchema, ApiSchema, HttpMethod};

/// Backend code generator
pub struct BackendGenerator<'a> {
    project: &'a ProjectSchema,
}

impl<'a> BackendGenerator<'a> {
    /// Create a new backend generator
    pub fn new(project: &'a ProjectSchema) -> Self {
        Self { project }
    }
    
    /// Generate all backend code
    pub fn generate(&self) -> GeneratedBackend {
        let mut files = Vec::new();
        
        // Group APIs by resource
        let mut controllers: std::collections::HashMap<String, Vec<&ApiSchema>> = std::collections::HashMap::new();
        
        for api in &self.project.apis {
            if !api.archived {
                // Extract resource name from path (e.g., /users -> users)
                let resource = api.path.split('/').nth(1).unwrap_or("api");
                controllers.entry(resource.to_string()).or_default().push(api);
            }
        }
        
        // Generate each controller
        for (resource, apis) in controllers {
            let code = self.generate_controller(&resource, &apis);
            files.push(GeneratedFile {
                path: format!("src/controllers/{}.controller.ts", resource),
                content: code,
            });
        }
        
        // Generate main.ts
        files.push(GeneratedFile {
            path: "src/main.ts".into(),
            content: self.generate_main(),
        });
        
        // Generate package.json
        files.push(GeneratedFile {
            path: "package.json".into(),
            content: self.generate_package_json(),
        });
        
        GeneratedBackend { files }
    }
    
    /// Generate a controller file
    fn generate_controller(&self, resource: &str, apis: &[&ApiSchema]) -> String {
        let pascal_name = to_pascal_case(resource);
        
        let mut methods = String::new();
        
        for api in apis {
            let decorator = match api.method {
                HttpMethod::Get => "Get",
                HttpMethod::Post => "Post",
                HttpMethod::Put => "Put",
                HttpMethod::Patch => "Patch",
                HttpMethod::Delete => "Delete",
            };
            
            // Extract path suffix after resource
            let path_suffix = api.path.strip_prefix(&format!("/{}", resource))
                .unwrap_or(&api.path);
            
            methods.push_str(&format!(r#"
    @{decorator}('{path}')
    async {method}() {{
        return {{ message: '{name} endpoint', method: '{decorator}', path: '{path}' }};
    }}
"#, decorator = decorator, path = path_suffix, method = to_camel_case(&api.name), name = api.name));
        }
        
        format!(r#"import {{ Controller, Get, Post, Put, Patch, Delete }} from '@nestjs/common';

@Controller('{resource}')
export class {pascal}Controller {{
{methods}}}
"#, resource = resource, pascal = pascal_name, methods = methods)
    }
    
    /// Generate main.ts entry point
    fn generate_main(&self) -> String {
        r#"import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    
    // Enable CORS
    app.enableCors();
    
    // Global prefix
    app.setGlobalPrefix('api');
    
    const port = process.env.PORT || 3000;
    await app.listen(port);
    
    console.log(`Application running on: http://localhost:${port}`);
}

bootstrap();
"#.into()
    }
    
    /// Generate package.json
    fn generate_package_json(&self) -> String {
        format!(r#"{{
    "name": "{}-backend",
    "version": "1.0.0",
    "scripts": {{
        "build": "nest build",
        "start": "nest start",
        "dev": "nest start --watch"
    }},
    "dependencies": {{
        "@nestjs/common": "^10.0.0",
        "@nestjs/core": "^10.0.0",
        "@nestjs/platform-express": "^10.0.0",
        "@prisma/client": "^5.0.0",
        "reflect-metadata": "^0.1.13",
        "rxjs": "^7.8.1"
    }},
    "devDependencies": {{
        "@nestjs/cli": "^10.0.0",
        "@types/node": "^20.0.0",
        "prisma": "^5.0.0",
        "typescript": "^5.3.0"
    }}
}}
"#, self.project.name.to_lowercase().replace(' ', "-"))
    }
}

/// Generated backend output
pub struct GeneratedBackend {
    pub files: Vec<GeneratedFile>,
}

/// A generated file
pub struct GeneratedFile {
    pub path: String,
    pub content: String,
}

/// Convert snake_case to PascalCase
fn to_pascal_case(s: &str) -> String {
    s.split('_')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().chain(chars).collect(),
            }
        })
        .collect()
}

/// Convert a name to camelCase
fn to_camel_case(s: &str) -> String {
    let words: Vec<&str> = s.split(|c: char| !c.is_alphanumeric()).collect();
    let mut result = String::new();
    
    for (i, word) in words.iter().enumerate() {
        if word.is_empty() { continue; }
        
        if i == 0 {
            result.push_str(&word.to_lowercase());
        } else {
            let mut chars = word.chars();
            if let Some(first) = chars.next() {
                result.push(first.to_ascii_uppercase());
                result.extend(chars.map(|c| c.to_ascii_lowercase()));
            }
        }
    }
    
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_pascal_case() {
        assert_eq!(to_pascal_case("users"), "Users");
        assert_eq!(to_pascal_case("user_profiles"), "UserProfiles");
    }
    
    #[test]
    fn test_to_camel_case() {
        assert_eq!(to_camel_case("Get Users"), "getUsers");
        assert_eq!(to_camel_case("Create User"), "createUser");
    }
    
    #[test]
    fn test_generate_backend() {
        let mut project = ProjectSchema::new("proj-1", "My App");
        project.add_api(ApiSchema::new("api-1", HttpMethod::Get, "/users", "Get Users"));
        project.add_api(ApiSchema::new("api-2", HttpMethod::Post, "/users", "Create User"));
        
        let generator = BackendGenerator::new(&project);
        let output = generator.generate();
        
        // Should have controller file
        let controller = output.files.iter().find(|f| f.path.contains("users.controller.ts"));
        assert!(controller.is_some());
    }
}
