# Muze CLI

一个前端项目开发工具，帮助你提高开发效率。

## 功能特点

- 🚀 项目模板创建
- 📦 Git 提交规范化
- 🔍 项目文件分析
- 🧹 未引用文件清理
- 📊 项目统计分析

## 安装

```bash
# 全局安装
npm install -g muze-cli

# 或者使用 yarn
yarn global add muze-cli
```

## 使用方法

### 创建项目

```bash
muze-cli create <project-name>
```

支持多种项目模板：

- C 端项目： Next.js + TypeScript + TailwindCss ...
- B 端项目模板：Umi + TypeScript + Ant Design ....
- 更多模板持续添加中...

### Git 提交

规范化的 Git 提交信息：

```bash
muze-cli commit
```

交互式提交，支持以下类型：

- feat: 新功能
- fix: 修复
- docs: 文档
- style: 样式
- refactor: 重构
- test: 测试
- chore: 构建/依赖

### 清理未引用文件

分析并清理项目中未被引用的文件：

```bash
# 分析未引用文件
muze-cli clean

# 导出分析结果到 Excel
muze-cli clean --export

# 删除未引用文件
muze-cli clean --remove
```

## 核心功能实现思路

### 1. 项目创建 (create)

核心实现：

- 使用 `download-git-repo` 下载模板
- 使用 `inquirer` 实现交互式命令行
- 模板变量替换

关键代码：

```typescript
async function create(projectName: string) {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: '请选择项目模板',
      choices: templates
    }
  ])

  // 下载模板
  await downloadTemplate(answers.template, projectName)

  // 处理模板变量
  await processTemplateFiles(projectName)
}
```

### 2. Git 提交 (commit)

核心实现：

- 使用 `inquirer` 实现交互式提交
- 使用 `child_process` 执行 git 命令
- 提交信息格式化

关键代码：

```typescript
async function commit() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: '选择提交类型',
      choices: commitTypes
    },
    {
      type: 'input',
      name: 'message',
      message: '输入提交信息'
    }
  ])

  const commitMessage = formatCommitMessage(answers)
  execSync('git add .')
  execSync(`git commit -m "${commitMessage}"`)
}
```

### 3. 未引用文件清理 (clean)

核心实现：

- 使用 `@babel/parser` 解析代码为 AST
- 使用 `@babel/traverse` 遍历 AST 分析导入
- 使用 `xlsx` 生成 Excel 报告

关键代码：

```typescript
async function clean(options: CleanOptions) {
  // 获取所有源文件
  const sourceFiles = getAllFiles('.').filter((file) =>
    /\.(js|ts|vue)$/.test(file)
  )

  // 分析文件引用
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript']
  })

  // 遍历 AST 收集导入
  traverse(ast, {
    ImportDeclaration(path) {
      const importPath = path.node.source.value
      if (importPath.startsWith('.')) {
        // 处理相对导入
        const absolutePath = resolveImportPath(file, importPath)
        referenceCount.set(
          absolutePath,
          (referenceCount.get(absolutePath) || 0) + 1
        )
      }
    }
  })
}
```

## 配置项

### .gitignore 支持

CLI 工具会自动读取项目中的 `.gitignore` 文件，在分析时排除被忽略的文件。
