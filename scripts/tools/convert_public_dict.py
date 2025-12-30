#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
转换公共法语学习词典.txt为项目可用的JSON格式
严谨地解析txt文件结构并转换为标准JSON格式
"""

import json
import re
import os
from pathlib import Path
from collections import defaultdict
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parents[2]
TXT_FILE = BASE_DIR / '公共法语学习词典.txt'
DICT_DIR = BASE_DIR / 'public' / 'data' / 'dicts'

# 词性映射（从txt中的缩写到标准格式）
POS_MAPPING = {
    'n.': {'abbr': 'n.', 'full': '名词', 'pos_key': 'noun'},
    'n. m.': {'abbr': 'n. m.', 'full': '阳性名词', 'pos_key': 'noun'},
    'n. f.': {'abbr': 'n. f.', 'full': '阴性名词', 'pos_key': 'noun'},
    'v.': {'abbr': 'v.', 'full': '动词', 'pos_key': 'verb'},
    'v. t.': {'abbr': 'v. t.', 'full': '及物动词', 'pos_key': 'verb'},
    'v. t. ind.': {'abbr': 'v. t. ind.', 'full': '间接及物动词', 'pos_key': 'verb'},
    'v. i.': {'abbr': 'v. i.', 'full': '不及物动词', 'pos_key': 'verb'},
    'v. pr.': {'abbr': 'v. pr.', 'full': '代动词', 'pos_key': 'verb'},
    'a.': {'abbr': 'a.', 'full': '形容词', 'pos_key': 'adj'},
    'adv.': {'abbr': 'adv.', 'full': '副词', 'pos_key': 'adv'},
    'prép.': {'abbr': 'prép.', 'full': '介词', 'pos_key': 'prep'},
    'conj.': {'abbr': 'conj.', 'full': '连词', 'pos_key': 'conj'},
    'pron.': {'abbr': 'pron.', 'full': '代词', 'pos_key': 'pron'},
    'det.': {'abbr': 'det.', 'full': '限定词', 'pos_key': 'det'},
    'art.': {'abbr': 'art.', 'full': '冠词', 'pos_key': 'det'},
    'interj.': {'abbr': 'interj.', 'full': '感叹词', 'pos_key': 'adv'},
}

def parse_pos_from_line(line):
    """从词条行解析词性信息"""
    # 匹配格式：> 词 词性. [额外信息]
    # 例如：> à prép. [与定冠词 le, les 构成缩合冠词au, aux]
    # 例如：> abandonner v. t.
    # 例如：> abîmé， e a.
    # 例如：> après prép. ; adv.
    
    # 更灵活的正则，匹配词和词性
    match = re.match(r'>\s*([^<>]+?)\s+([a-zé]+\.(?:\s+[a-zé]+\.?)*(?:\s*;\s*[a-zé]+\.(?:\s+[a-zé]+\.?)*)?)\s*(?:\[([^\]]+)\])?', line)
    if not match:
        return None, None, None, None
    
    word_part = match.group(1).strip()
    pos_part = match.group(2).strip()
    extra_info = match.group(3) if match.group(3) else None
    
    # 处理词形（可能包含变位形式，如"abîmé， e"）
    # 提取主词形（逗号前的部分，去除音标等）
    word = word_part.split('，')[0].split(',')[0].strip()
    # 去除音标，如 "*hall [ol]" -> "hall"
    word = re.sub(r'\s*\[[^\]]+\]', '', word).strip()
    # 去除星号
    word = word.lstrip('*')
    
    # 处理多个词性（用分号分隔）
    pos_parts = [p.strip() for p in pos_part.split(';')]
    primary_pos = pos_parts[0]
    
    # 解析词性
    pos_info = POS_MAPPING.get(primary_pos)
    if not pos_info:
        # 尝试匹配部分词性（去掉空格）
        normalized_pos = primary_pos.replace(' ', '')
        for key, value in POS_MAPPING.items():
            if normalized_pos == key.replace(' ', '') or primary_pos.startswith(key.split()[0]):
                pos_info = value
                break
    
    # 如果还是找不到，尝试模糊匹配
    if not pos_info:
        for key, value in POS_MAPPING.items():
            if key.split('.')[0] in primary_pos:
                pos_info = value
                break
    
    return word, pos_info, pos_part, extra_info

def extract_gender_from_pos(pos_str, word):
    """从词性字符串提取性别信息"""
    if 'n. m.' in pos_str or 'm.' in pos_str:
        return 'm'
    elif 'n. f.' in pos_str or 'f.' in pos_str:
        return 'f'
    return None

def parse_definitions(lines, start_idx):
    """解析词条的释义部分"""
    definitions = []
    
    i = start_idx
    while i < len(lines):
        line = lines[i].strip()
        
        # 如果遇到新的词条标记，停止
        if line.startswith('<'):
            break
        
        # 如果遇到新词条（>开头），停止
        if line.startswith('>') and i > start_idx:
            break
        
        # 如果遇到空行，检查下一个非空行
        if not line:
            # 检查下一行是否是新的词条
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                if next_line.startswith('>') or next_line.startswith('<'):
                    break
            i += 1
            continue
        
        # 匹配释义行：数字 [分类]释义:◇例句 翻译。
        # 或者：数字 释义:◇例句 翻译。
        match = re.match(r'(\d+)\s*(?:\[([^\]]+)\])?\s*(.+?)$', line)
        if match:
            num = match.group(1)
            category = match.group(2) if match.group(2) else None
            content = match.group(3).strip()
            
            # 解析内容（可能包含例句）
            # 格式：释义:◇例句 翻译。
            def_text = content
            
            # 清理文本
            def_text = re.sub(r'◇', ' ', def_text)  # 替换◇为空格
            def_text = re.sub(r'\s+', ' ', def_text)  # 合并多个空格
            def_text = def_text.strip()
            
            if def_text:
                def_obj = {'text': def_text}
                if category:
                    def_obj['category'] = category
                definitions.append(def_obj)
        else:
            # 可能是续行（没有数字开头，但也不是新词条）
            # 检查是否是纯文本续行
            if definitions and line and not line.startswith('<') and not line.startswith('>'):
                # 追加到最后一个定义
                last_def = definitions[-1]
                last_def['text'] += ' ' + line.strip()
        
        i += 1
    
    return definitions, i

def parse_txt_file(txt_path):
    """解析txt文件，返回按词性分类的词条"""
    words_by_pos = defaultdict(list)
    word_dict = {}  # 用于去重和合并
    
    print(f"正在读取文件: {txt_path}")
    with open(txt_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"总行数: {len(lines)}")
    
    i = 0
    entry_count = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        # 跳过词条编号标记 <数字>
        if line.startswith('<') and line.endswith('>'):
            i += 1
            continue
        
        # 处理词条行：> 词 词性. [信息]
        if line.startswith('>'):
            word, pos_info, pos_str, extra_info = parse_pos_from_line(line)
            
            if not word or not pos_info:
                i += 1
                continue
            
            entry_count += 1
            
            # 解析释义
            definitions, next_idx = parse_definitions(lines, i + 1)
            
            # 如果没有释义，创建一个默认的
            if not definitions:
                definitions = [{'text': pos_info['full']}]
            
            # 提取性别信息（仅对名词）
            gender = None
            if pos_info['pos_key'] == 'noun':
                gender = extract_gender_from_pos(pos_str, word)
            
            # 构建词条对象
            word_key = word.lower()
            word_obj = {
                'word': word,
                'pos': [{'abbr': pos_info['abbr'], 'full': pos_info['full']}],
                'gender': gender,
                'tags': [],
                'raw_tags': '',
                'definitions': definitions
            }
            
            # 如果有额外信息，添加到tags或definitions
            if extra_info:
                word_obj['extra_info'] = extra_info
            
            # 处理动词的特殊信息
            if pos_info['pos_key'] == 'verb':
                if 't.' in pos_str:
                    word_obj['verb_type'] = 'transitive'
                elif 'i.' in pos_str:
                    word_obj['verb_type'] = 'intransitive'
                elif 'pr.' in pos_str:
                    word_obj['verb_type'] = 'reflexive'
            
            # 去重：如果已存在，合并词性和定义
            if word_key in word_dict:
                existing = word_dict[word_key]
                # 检查词性是否已存在
                existing_pos_abbrs = {p['abbr'] for p in existing['pos']}
                if pos_info['abbr'] not in existing_pos_abbrs:
                    existing['pos'].append({'abbr': pos_info['abbr'], 'full': pos_info['full']})
                # 合并定义
                existing['definitions'].extend(definitions)
            else:
                word_dict[word_key] = word_obj
                words_by_pos[pos_info['pos_key']].append(word_obj)
            
            i = next_idx
        else:
            i += 1
        
        # 进度提示
        if entry_count % 1000 == 0:
            print(f"  已处理 {entry_count} 个词条...")
    
    print(f"总共解析了 {entry_count} 个词条")
    return words_by_pos, word_dict

def generate_json_files(words_by_pos):
    """生成各词性的JSON文件"""
    DICT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 词性显示名称
    pos_display = {
        'noun': '名词',
        'verb': '动词',
        'adj': '形容词',
        'adv': '副词',
        'prep': '介词',
        'conj': '连词',
        'pron': '代词',
        'det': '限定词'
    }
    
    generated_files = []
    total_count = 0
    
    for pos_key, words in words_by_pos.items():
        if not words:
            continue
        
        # 按字母顺序排序
        words.sort(key=lambda x: x['word'].lower())
        
        # 生成JSON数据
        json_data = {
            'name': f'公共法语学习词典 - {pos_display.get(pos_key, pos_key)}',
            'pos': pos_key,
            'count': len(words),
            'source': '公共法语学习词典',
            'license': 'Unknown',
            'copyright': '',
            'version': '1.0.0',
            'generated_at': datetime.now().isoformat() + 'Z',
            'words': words
        }
        
        # 保存文件
        output_file = DICT_DIR / f'{pos_key}.json'
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        generated_files.append(output_file.name)
        total_count += len(words)
        print(f"  [OK] {pos_display.get(pos_key, pos_key)}: {len(words)} 个词条 -> {output_file.name}")
    
    return generated_files, total_count

def main():
    """主函数"""
    print("=" * 60)
    print("公共法语学习词典转换工具")
    print("=" * 60)
    print()
    
    if not TXT_FILE.exists():
        print(f"错误: 找不到文件 {TXT_FILE}")
        print("请确保文件在项目根目录下")
        return
    
    try:
        # 解析txt文件
        words_by_pos, word_dict = parse_txt_file(TXT_FILE)
        
        print()
        print("词性统计:")
        pos_display = {
            'noun': '名词',
            'verb': '动词',
            'adj': '形容词',
            'adv': '副词',
            'prep': '介词',
            'conj': '连词',
            'pron': '代词',
            'det': '限定词'
        }
        for pos_key, words in sorted(words_by_pos.items()):
            print(f"  - {pos_display.get(pos_key, pos_key)}: {len(words)} 个词条")
        print()
        
        # 生成JSON文件
        print("正在生成JSON文件...")
        generated_files, total_count = generate_json_files(words_by_pos)
        
        print()
        print("=" * 60)
        print("[SUCCESS] 转换完成!")
        print(f"  总词条数: {total_count:,}")
        print(f"  生成文件数: {len(generated_files)}")
        print(f"  输出目录: {DICT_DIR}")
        print("=" * 60)
        
    except Exception as e:
        print(f"错误: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

