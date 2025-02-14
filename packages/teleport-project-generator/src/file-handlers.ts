import { UIDLUtils, StringUtils } from '@teleporthq/teleport-shared'
import { HASTUtils, HASTBuilders } from '@teleporthq/teleport-plugin-common'
import {
  GeneratedFile,
  GeneratedFolder,
  ProjectUIDL,
  WebManifest,
  ChunkDefinition,
  ComponentUIDL,
  GeneratorOptions,
  ProjectStrategy,
  EntryFileOptions,
  CustomTag,
  Attribute,
  FileType,
  ChunkType,
  ComponentGenerator,
} from '@teleporthq/teleport-types'
import PathResolver from 'path'
import { DEFAULT_PACKAGE_JSON, DEFAULT_ROUTER_FILE_NAME } from './constants'
import { PackageJSON } from './types'
import { generateLocalDependenciesPrefix } from './utils'

export const createPage = async (
  pageUIDL: ComponentUIDL,
  generator: ComponentGenerator,
  options: GeneratorOptions
) => {
  return generator.generateComponent(pageUIDL, options)
}

export const createComponent = async (
  componentUIDL: ComponentUIDL,
  generator: ComponentGenerator,
  options: GeneratorOptions
) => {
  return generator.generateComponent(componentUIDL, options)
}

export const createComponentModule = async (
  uidl: ProjectUIDL,
  strategy: ProjectStrategy,
  generator: ComponentGenerator
) => {
  const { root } = uidl
  const { path } = strategy.components
  const componentLocalDependenciesPrefix = generateLocalDependenciesPrefix(
    path,
    strategy.components.path
  )

  const options = {
    localDependenciesPrefix: componentLocalDependenciesPrefix,
    strategy,
    moduleComponents: uidl.components,
  }

  root.outputOptions = root.outputOptions || {}
  root.outputOptions.fileName = 'components.module'

  return generator.generateComponent(root, options)
}

export const createPageModule = async (
  pageUIDL: ComponentUIDL,
  generator: ComponentGenerator,
  options: GeneratorOptions
) => {
  pageUIDL.outputOptions = pageUIDL.outputOptions || {}
  pageUIDL.outputOptions.moduleName = `${StringUtils.dashCaseToUpperCamelCase(
    pageUIDL.outputOptions.folderPath[0]
  )}Module`
  return generator.generateComponent(pageUIDL, options)
}

export const createRouterFile = async (
  root: ComponentUIDL,
  strategy: ProjectStrategy,
  routerGenerator: ComponentGenerator
) => {
  const { projectStyleSheet, router } = strategy
  const { path: routerFilePath, fileName } = router
  const routerLocalDependenciesPrefix = generateLocalDependenciesPrefix(
    routerFilePath,
    strategy.pages.path
  )

  let options: GeneratorOptions = {
    localDependenciesPrefix: routerLocalDependenciesPrefix,
    strategy,
    isRootComponent: true,
    designLanguage: root?.designLanguage,
  }

  if (projectStyleSheet) {
    const relativePathForProjectStyleSheet =
      PathResolver.relative(
        /* When each page is created inside a another folder then we just need to 
          add one more element to the path resolver to maintian the hierarcy */
        strategy.router.path.join('/'),
        strategy.projectStyleSheet.path.join('/')
      ) || '.'
    options = {
      ...options,
      projectStyleSet: {
        styleSetDefinitions: root?.styleSetDefinitions,
        fileName: projectStyleSheet.fileName,
        path: relativePathForProjectStyleSheet,
        importFile: projectStyleSheet?.importFile || false,
      },
    }
  }
  root.outputOptions = root.outputOptions || {}
  root.outputOptions.fileName = fileName || DEFAULT_ROUTER_FILE_NAME

  const { files, dependencies } = await routerGenerator.generateComponent(root, options)
  return { routerFile: files[0], dependencies }
}

export const createEntryFile = async (
  uidl: ProjectUIDL,
  strategy: ProjectStrategy,
  entryFileGenerator: ComponentGenerator,
  entryFileOptions: GeneratorOptions
) => {
  // If no function is provided in the strategy, the createHTMLEntryFileChunks is used by default
  const chunkGenerationFunction =
    strategy.entry.chunkGenerationFunction || createHTMLEntryFileChunks
  const { assetsPrefix } = entryFileOptions
  const options = { ...strategy.entry?.options, ...entryFileOptions }

  const appRootOverride = (options && options.appRootOverride) || null

  const entryFileName = strategy.entry.fileName || 'index'
  const customHeadContent = (options && options.customHeadContent) || null
  const customTags = (options && options.customTags) || []
  const chunks = chunkGenerationFunction(uidl, {
    assetsPrefix,
    appRootOverride,
    customHeadContent,
    customTags,
  })

  const result = entryFileGenerator.linkCodeChunks(chunks, entryFileName)
  return result
}

// Default function used to generate the html file based on the global settings in the ProjectUIDL
const createHTMLEntryFileChunks = (uidl: ProjectUIDL, options: EntryFileOptions) => {
  const { assetsPrefix = '', appRootOverride, customHeadContent, customTags } = options
  const { settings, meta, assets, manifest, customCode } = uidl.globals

  const htmlNode = HASTBuilders.createHTMLNode('html')
  const headNode = HASTBuilders.createHTMLNode('head')
  const bodyNode = HASTBuilders.createHTMLNode('body')

  HASTUtils.addChildNode(htmlNode, headNode)
  HASTUtils.addChildNode(htmlNode, bodyNode)

  // Vue and React use a standard <div id="app"/> in the body tag.
  // Nuxt has an internal templating so requires an override
  if (appRootOverride) {
    HASTUtils.addTextNode(bodyNode, appRootOverride)
  } else {
    const appRootNode = HASTBuilders.createHTMLNode('div')
    HASTUtils.addAttributeToNode(appRootNode, 'id', 'app')
    HASTUtils.addChildNode(bodyNode, appRootNode)
  }

  if (settings.language) {
    HASTUtils.addAttributeToNode(htmlNode, 'lang', settings.language)
  }

  if (settings.title) {
    const titleTag = HASTBuilders.createHTMLNode('title')
    HASTUtils.addTextNode(titleTag, settings.title)
    HASTUtils.addChildNode(headNode, titleTag)
  }

  /* For frameworks that need to inject and point out the generated build files
  or adding some script tags in head or body */
  if (customTags.length > 0) {
    customTags.forEach((tag: CustomTag) => {
      const { targetTag, tagName, attributes, content } = tag
      const targetNode = targetTag === 'head' ? headNode : bodyNode
      const createdNode = HASTBuilders.createHTMLNode(tagName)

      if (content) {
        HASTUtils.addTextNode(createdNode, content)
      }

      if (attributes && attributes.length > 0) {
        attributes.forEach((attribute: Attribute) => {
          const { attributeKey, attributeValue } = attribute
          if (attributeValue) {
            HASTUtils.addAttributeToNode(createdNode, attributeKey, attributeValue)
          } else {
            HASTUtils.addBooleanAttributeToNode(createdNode, attributeKey)
          }
        })
      }

      HASTUtils.addChildNode(targetNode, createdNode)
    })
  }

  if (manifest) {
    const linkTag = HASTBuilders.createHTMLNode('link')
    HASTUtils.addAttributeToNode(linkTag, 'rel', 'manifest')
    HASTUtils.addAttributeToNode(linkTag, 'href', `${options.assetsPrefix}/manifest.json`)
    HASTUtils.addChildNode(headNode, linkTag)
  }

  meta.forEach((metaItem) => {
    const metaTag = HASTBuilders.createHTMLNode('meta')
    Object.keys(metaItem).forEach((key) => {
      const prefixedURL = UIDLUtils.prefixAssetsPath(assetsPrefix, metaItem[key])
      HASTUtils.addAttributeToNode(metaTag, key, prefixedURL)
    })
    HASTUtils.addChildNode(headNode, metaTag)
  })

  assets.forEach((asset) => {
    let assetPath
    if ('path' in asset) {
      assetPath = UIDLUtils.prefixAssetsPath(options.assetsPrefix, asset.path)
    }

    // link canonical for SEO
    if (asset.type === 'canonical' && assetPath) {
      const linkTag = HASTBuilders.createHTMLNode('link')
      HASTUtils.addAttributeToNode(linkTag, 'rel', 'canonical')
      HASTUtils.addAttributeToNode(linkTag, 'href', assetPath)
      HASTUtils.addChildNode(headNode, linkTag)
    }

    // link stylesheet (external css, font)
    if ((asset.type === 'style' || asset.type === 'font') && assetPath) {
      const linkTag = HASTBuilders.createHTMLNode('link')
      HASTUtils.addAttributeToNode(linkTag, 'rel', 'stylesheet')
      HASTUtils.addAttributeToNode(linkTag, 'href', assetPath)
      HASTUtils.addChildNode(headNode, linkTag)
    }

    // inline style
    if (asset.type === 'style' && 'content' in asset) {
      const styleTag = HASTBuilders.createHTMLNode('style')
      HASTUtils.addTextNode(styleTag, asset.content)
      HASTUtils.addChildNode(headNode, styleTag)
    }

    // script (external or inline)
    if (asset.type === 'script') {
      const scriptInBody = (asset.options && asset.options.target === 'body') || false
      const scriptTag = HASTBuilders.createHTMLNode('script')
      HASTUtils.addAttributeToNode(scriptTag, 'type', 'text/javascript')

      if (assetPath) {
        HASTUtils.addAttributeToNode(scriptTag, 'src', assetPath)
        if (asset.options && asset.options.defer) {
          HASTUtils.addBooleanAttributeToNode(scriptTag, 'defer')
        }
        if (asset.options && asset.options.async) {
          HASTUtils.addBooleanAttributeToNode(scriptTag, 'async')
        }
      } else if ('content' in asset) {
        HASTUtils.addTextNode(scriptTag, asset.content)
      }

      if (scriptInBody) {
        HASTUtils.addChildNode(bodyNode, scriptTag)
      } else {
        HASTUtils.addChildNode(headNode, scriptTag)
      }
    }

    // icon
    if (asset.type === 'icon' && assetPath) {
      const iconTag = HASTBuilders.createHTMLNode('link')
      HASTUtils.addAttributeToNode(iconTag, 'rel', 'shortcut icon')
      HASTUtils.addAttributeToNode(iconTag, 'href', assetPath)

      if (asset.options && asset.options.iconType) {
        HASTUtils.addAttributeToNode(iconTag, 'type', asset.options.iconType)
      }
      if (asset.options && asset.options.iconSizes) {
        HASTUtils.addAttributeToNode(iconTag, 'sizes', asset.options.iconSizes)
      }
      HASTUtils.addChildNode(headNode, iconTag)
    }
  })

  if (customHeadContent) {
    HASTUtils.addTextNode(headNode, customHeadContent)
  }

  if (customCode?.head) {
    HASTUtils.addTextNode(headNode, customCode.head)
  }

  if (customCode?.body) {
    HASTUtils.addTextNode(bodyNode, customCode.body)
  }

  const chunks: Record<string, ChunkDefinition[]> = {
    [FileType.HTML]: [
      {
        name: 'doctype',
        type: ChunkType.STRING,
        fileType: FileType.HTML,
        content: '<!DOCTYPE html>',
        linkAfter: [],
      },
      {
        name: 'html-node',
        type: ChunkType.HAST,
        fileType: FileType.HTML,
        content: htmlNode,
        linkAfter: ['doctype'],
      },
    ],
  }

  return chunks
}

// Creates a manifest json file with the UIDL having priority over the default values
export const createManifestJSONFile = (uidl: ProjectUIDL, assetsPrefix?: string): GeneratedFile => {
  const manifest = uidl.globals.manifest
  const projectName = uidl.name
  const defaultManifest: WebManifest = {
    short_name: projectName,
    name: projectName,
    display: 'standalone',
    start_url: '/',
  }

  const icons = manifest.icons.map((icon) => {
    const src = UIDLUtils.prefixAssetsPath(assetsPrefix || '', icon.src)
    return { ...icon, src }
  })

  const content = {
    ...defaultManifest,
    ...manifest,
    ...{ icons },
  }

  return {
    name: 'manifest',
    fileType: FileType.JSON,
    content: JSON.stringify(content, null, 2),
  }
}

export const handlePackageJSON = (
  template: GeneratedFolder,
  uidl: ProjectUIDL,
  dependencies: Record<string, string>,
  devDependencies?: Record<string, string>
) => {
  const inputPackageJSONFile = template.files.find(
    (file) => file.name === 'package' && file.fileType === FileType.JSON
  )

  if (inputPackageJSONFile) {
    const packageJSONContent = JSON.parse(inputPackageJSONFile.content) as PackageJSON

    packageJSONContent.name = StringUtils.slugify(uidl.name)
    packageJSONContent.dependencies = {
      ...packageJSONContent.dependencies,
      ...dependencies,
    }

    packageJSONContent.devDependencies = {
      ...packageJSONContent.devDependencies,
      ...(Object.keys(devDependencies || {}).length > 0 && devDependencies),
    }

    inputPackageJSONFile.content = JSON.stringify(packageJSONContent, null, 2)
  } else {
    const content: PackageJSON = {
      ...DEFAULT_PACKAGE_JSON,
      name: StringUtils.slugify(uidl.name),
      dependencies,
      ...(Object.keys(devDependencies || {}).length > 0 && { devDependencies }),
    }

    template.files.push({
      name: 'package',
      fileType: FileType.JSON,
      content: JSON.stringify(content, null, 2),
    })
  }
}
