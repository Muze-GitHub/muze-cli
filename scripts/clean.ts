import { execSync } from 'child_process'
import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import * as XLSX from 'xlsx'
import * as parser from '@babel/parser'
import traverse from '@babel/traverse'

interface CleanOptions {
  export?: boolean // 是否导出 Excel
  remove?: boolean // 是否删除未使用的文件
}

interface FileInfo {
  path: string
  size: number
  lastModified: string
  type: string
  references: number
}

interface ImportInfo {
  source: string
  importedBy: string
}

export default async function clean(options: CleanOptions = {}) {
  try {
    const spinner = ora('正在分析项目文件...').start()

    // 检查是否在项目根目录
    if (!fs.existsSync('package.json')) {
      spinner.fail(chalk.red('请在项目根目录下运行此命令'))
      return
    }

    // 获取所有源代码文件
    spinner.text = '正在收集项目文件...'
    const files = getAllFiles('.')
    const sourceFiles = files.filter(
      (file) =>
        /\.(js|jsx|ts|tsx|vue)$/.test(file) &&
        !file.includes('node_modules') &&
        !file.includes('dist') &&
        !file.includes('.git')
    )

    // 分析文件引用关系
    spinner.text = '正在分析文件引用关系...'
    const unusedFiles: FileInfo[] = []
    const referenceCount = new Map<string, number>()
    const imports: ImportInfo[] = []

    // 初始化引用计数
    sourceFiles.forEach((file) => referenceCount.set(file, 0))

    // 分析每个文件的引用
    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8')
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: [
            'jsx',
            'typescript',
            'decorators-legacy',
            'classProperties',
            'dynamicImport'
          ]
        })

        traverse.default(ast, {
          ImportDeclaration(path) {
            const importPath = path.node.source.value
            if (importPath.startsWith('.')) {
              const absolutePath = resolveImportPath(file, importPath)
              if (absolutePath) {
                imports.push({
                  source: absolutePath,
                  importedBy: file
                })
                // 增加引用计数
                const normalizedPath = absolutePath.replace(/\.[^/.]+$/, '')
                sourceFiles.forEach((sourceFile) => {
                  if (sourceFile.replace(/\.[^/.]+$/, '') === normalizedPath) {
                    const count = referenceCount.get(sourceFile) || 0
                    referenceCount.set(sourceFile, count + 1)
                  }
                })
              }
            }
          },
          CallExpression(path) {
            if (
              (path.node.callee.type === 'Identifier' &&
                path.node.callee.name === 'require') ||
              path.node.callee.type === 'Import'
            ) {
              const args = path.node.arguments
              if (args.length > 0 && args[0].type === 'StringLiteral') {
                const importPath = args[0].value
                if (importPath.startsWith('.')) {
                  const absolutePath = resolveImportPath(file, importPath)
                  if (absolutePath) {
                    imports.push({
                      source: absolutePath,
                      importedBy: file
                    })
                    // 增加引用计数
                    const normalizedPath = absolutePath.replace(/\.[^/.]+$/, '')
                    sourceFiles.forEach((sourceFile) => {
                      if (
                        sourceFile.replace(/\.[^/.]+$/, '') === normalizedPath
                      ) {
                        const count = referenceCount.get(sourceFile) || 0
                        referenceCount.set(sourceFile, count + 1)
                      }
                    })
                  }
                }
              }
            }
          }
        })
      } catch (error) {
        console.log(chalk.yellow(`\n⚠️ 解析文件失败: ${file}`))
        if (error instanceof Error) {
          console.log(chalk.gray(error.message))
        }
      }
    }

    // 统计引用次数
    imports.forEach(({ source }) => {
      if (referenceCount.has(source)) {
        referenceCount.set(source, referenceCount.get(source)! + 1)
      }
    })

    // 收集未使用的文件
    referenceCount.forEach((count, file) => {
      // 检查是否为入口文件
      const isEntryFile = isEntry(file)
      if (count === 0 && !isEntryFile) {
        const stats = fs.statSync(file)
        unusedFiles.push({
          path: file,
          size: stats.size,
          lastModified: stats.mtime.toLocaleString(),
          type: path.extname(file),
          references: count
        })
      }
    })

    // 输出结果
    console.log('\n' + chalk.blue('📊 未使用文件分析:'))
    console.log(chalk.gray(`项目总文件数: ${files.length}`))
    console.log(chalk.gray(`源代码文件数: ${sourceFiles.length}`))
    console.log(chalk.gray(`未使用文件数: ${unusedFiles.length}`))

    if (unusedFiles.length > 0) {
      console.log('\n未使用的文件列表:')
      unusedFiles.forEach((file) => {
        const relativePath = path.relative(process.cwd(), file.path)
        console.log(chalk.green(`- ${relativePath} (${formatSize(file.size)})`))
      })

      // 导出 Excel
      if (options.export && unusedFiles.length > 0) {
        const workbook = XLSX.utils.book_new()
        const worksheet = XLSX.utils.json_to_sheet(
          unusedFiles.map((file) => ({
            ...file,
            path: path.relative(process.cwd(), file.path),
            size: formatSize(file.size)
          }))
        )
        XLSX.utils.book_append_sheet(workbook, worksheet, '未使用文件')
        XLSX.writeFile(workbook, '未引用文件.xlsx')
        console.log(chalk.green('\n✨ Excel 文件已导出: 未引用文件.xlsx'))
      }

      // 删除未使用的文件
      if (options.remove) {
        spinner.text = '正在删除未使用的文件...'
        unusedFiles.forEach((file) => {
          try {
            fs.unlinkSync(file.path)
            console.log(chalk.gray(`已删除: ${file.path}`))
          } catch (error) {
            console.log(chalk.red(`删除失败: ${file.path}`))
          }
        })
      }
    }

    spinner.succeed(chalk.green('分析完成!'))
  } catch (error) {
    console.error(chalk.red('\n❌ 分析失败:'))
    if (error instanceof Error) {
      console.error(chalk.red(error.message))
    }
    process.exit(1)
  }
}

// 解析 .gitignore 文件
function parseGitignore(): string[] {
  try {
    if (fs.existsSync('.gitignore')) {
      const content = fs.readFileSync('.gitignore', 'utf-8')
      return content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
    }
  } catch (error) {
    console.log(chalk.yellow('\n⚠️ 解析 .gitignore 文件失败'))
  }
  return []
}

// 检查文件是否被 gitignore
function isIgnored(file: string, ignorePatterns: string[]): boolean {
  const relativePath = path.relative(process.cwd(), file)
  return ignorePatterns.some((pattern) => {
    // 处理目录通配符
    if (pattern.endsWith('/')) {
      return relativePath.startsWith(pattern)
    }
    // 处理文件通配符
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
      return regex.test(relativePath)
    }
    // 精确匹配
    return relativePath === pattern
  })
}

// 递归获取所有文件
function getAllFiles(dir: string): string[] {
  const files: string[] = []
  const ignorePatterns = parseGitignore()
  const items = fs.readdirSync(dir)

  items.forEach((item) => {
    const fullPath = path.resolve(dir, item)
    if (fs.statSync(fullPath).isDirectory()) {
      if (
        !['node_modules', '.git', 'dist'].includes(item) &&
        !isIgnored(fullPath, ignorePatterns)
      ) {
        files.push(...getAllFiles(fullPath))
      }
    } else {
      if (!isIgnored(fullPath, ignorePatterns)) {
        files.push(fullPath)
      }
    }
  })

  return files
}

// 格式化文件大小
function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

// 解析导入路径
function resolveImportPath(
  fromFile: string,
  importPath: string
): string | null {
  try {
    const absolutePath = path.resolve(path.dirname(fromFile), importPath)
    const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue']

    // 如果导入路径已经包含扩展名
    if (path.extname(importPath)) {
      const pathWithoutExt = absolutePath.replace(/\.[^/.]+$/, '')
      // 检查对应的源文件
      for (const ext of possibleExtensions) {
        const sourcePath = pathWithoutExt + ext
        if (fs.existsSync(sourcePath)) {
          return sourcePath
        }
      }
    }

    // 检查不同扩展名的文件
    for (const ext of possibleExtensions) {
      const pathWithExt = absolutePath + ext
      if (fs.existsSync(pathWithExt)) {
        return pathWithExt
      }
    }

    // 检查 index 文件
    if (
      fs.existsSync(absolutePath) &&
      fs.statSync(absolutePath).isDirectory()
    ) {
      for (const ext of possibleExtensions) {
        const indexPath = path.join(absolutePath, `index${ext}`)
        if (fs.existsSync(indexPath)) {
          return indexPath
        }
      }
    }
  } catch (error) {
    console.log(chalk.yellow(`\n⚠️ 解析导入路径失败: ${importPath}`))
  }

  return null
}

// 检查是否为入口文件
function isEntry(file: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
    const possibleEntries = [
      pkg.main,
      pkg.module,
      pkg.browser,
      ...(pkg.bin ? Object.values(pkg.bin) : []),
      'index.ts',
      'index.js',
      'main.ts',
      'main.js',
      'app.ts',
      'app.js'
    ].filter(Boolean)

    return possibleEntries.some((entry) => {
      if (!entry) return false
      const entryPath = path.resolve(entry)
      return file === entryPath || file.startsWith(entryPath)
    })
  } catch (error) {
    return false
  }
}
