#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
导入 French-Dictionary (GitHub: hbenbel/French-Dictionary) 词典数据
每个CSV文件转换为独立的JSON文件，保留所有原始信息
理解每个CSV的结构：
- noun.csv: 名词，包含form和tags（tags中有gender信息）
- verb.csv: 动词，包含form和tags（tags中有变位、时态、人称等信息）
- adj.csv: 形容词，包含form和tags
- 其他词性类似
"""

import json
import csv
import ast
import os
from pathlib import Path
from collections import defaultdict

BASE_DIR = Path(__file__).resolve().parents[2]
DICT_DIR = BASE_DIR / 'public' / 'data' / 'dicts'

# 词性映射
POS_INFO = {
    'noun': {'abbr': 'n.', 'full': '名词', 'file': 'noun.csv'},
    'verb': {'abbr': 'v.', 'full': '动词', 'file': 'verb.csv'},
    'adj': {'abbr': 'a.', 'full': '形容词', 'file': 'adj.csv'},
    'adv': {'abbr': 'adv.', 'full': '副词', 'file': 'adv.csv'},
    'conj': {'abbr': 'conj.', 'full': '连词', 'file': 'conj.csv'},
    'prep': {'abbr': 'prép.', 'full': '介词', 'file': 'prep.csv'},
    'pron': {'abbr': 'pron.', 'full': '代词', 'file': 'pron.csv'},
    'det': {'abbr': 'det.', 'full': '限定词', 'file': 'det.csv'}
}

def parse_tags(tags_str):
    """解析tags字符串"""
    if not tags_str or tags_str.strip() == '':
        return []
    try:
        tags = ast.literal_eval(tags_str)
        if isinstance(tags, list):
            return [str(tag).lower() for tag in tags]
        return []
    except:
        return []

def is_base_form(tags):
    """判断是否是词的原形（非变位、非复数等）"""
    if not tags:
        return True
    excluded = ['plural', 'singular', 'present', 'past', 'future', 
                'imperfect', 'conditional', 'subjunctive', 'imperative',
                'first-person', 'second-person', 'third-person',
                'reflexive', 'participle', 'infinitive', 'masculine', 'feminine']
    return not any(tag in excluded for tag in tags)

def process_noun_csv(csv_path):
    """处理名词CSV - 理解结构：form是词形，tags包含gender等信息"""
    words = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            form = row.get('form', '').strip()
            tags_str = row.get('tags', '').strip()
            if not form:
                continue
            
            tags = parse_tags(tags_str)
            gender = None
            for tag in tags:
                if tag == 'masculine':
                    gender = 'm'
                    break
                elif tag == 'feminine':
                    gender = 'f'
                    break
            
            # 优先保存原形词（没有复数等标签的）
            key = form.lower()
            if key not in words or (is_base_form(tags) and not is_base_form(parse_tags(words[key].get('raw_tags', '')))):
                words[key] = {
                    'word': form,
                    'pos': [{'abbr': f"n.{gender}." if gender else 'n.', 'full': f"{'阳性' if gender == 'm' else '阴性' if gender == 'f' else ''}名词".strip()}],
                    'gender': gender,
                    'tags': tags,
                    'raw_tags': tags_str,
                    'definitions': [{'text': f"名词{'（' + ('阳性' if gender == 'm' else '阴性') + '）' if gender else ''}"}]
                }
    
    return list(words.values())

def process_verb_csv(csv_path):
    """
    处理动词CSV - 理解结构：form是词形，tags包含变位、时态、人称等信息
    动词CSV的特殊性：
    - 同一个动词可能有多个变位形式（je suis, tu es, il est等）
    - 需要识别原形（infinitive）作为主词条
    - 变位信息存储在tags中，包括时态、人称、数等
    """
    words = {}
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            form = row.get('form', '').strip()
            tags_str = row.get('tags', '').strip()
            if not form:
                continue
            
            tags = parse_tags(tags_str)
            
            # 提取动词类型
            verb_type = None
            if 'transitive' in tags:
                verb_type = 'transitive'
            elif 'intransitive' in tags:
                verb_type = 'intransitive'
            elif 'reflexive' in tags:
                verb_type = 'reflexive'
            elif 'auxiliary' in tags:
                verb_type = 'auxiliary'
            elif 'impersonal' in tags:
                verb_type = 'impersonal'
            
            # 提取变位信息 - 更详细地处理
            conjugation_info = []
            tense_tags = ['present', 'past', 'future', 'imperfect', 'conditional', 
                         'subjunctive', 'imperative', 'infinitive', 'participle']
            person_tags = ['first-person', 'second-person', 'third-person']
            number_tags = ['singular', 'plural']
            
            # 提取时态信息
            tenses = [tag for tag in tags if tag in tense_tags]
            persons = [tag for tag in tags if tag in person_tags]
            numbers = [tag for tag in tags if tag in number_tags]
            
            # 构建变位描述
            conjugation_desc = []
            if tenses:
                conjugation_desc.extend(tenses)
            if persons:
                conjugation_desc.extend(persons)
            if numbers:
                conjugation_desc.extend(numbers)
            
            # 判断是否是原形（infinitive）
            is_infinitive = 'infinitive' in tags
            
            # 使用原形作为key，如果不是原形则尝试找到对应的原形
            # 注意：这里简化处理，实际可能需要更复杂的词形还原
            key = form.lower()
            
            # 如果是原形，直接保存
            if is_infinitive:
                type_full = {'transitive': '及物动词', 'intransitive': '不及物动词', 
                            'reflexive': '代动词', 'auxiliary': '助动词', 
                            'impersonal': '无人称动词'}.get(verb_type, '动词')
                
                words[key] = {
                    'word': form,
                    'pos': [{'abbr': 'v.', 'full': type_full}],
                    'verb_type': verb_type,
                    'conjugation': ', '.join(conjugation_desc) if conjugation_desc else None,
                    'conjugation_info': conjugation_desc if conjugation_desc else None,
                    'tags': tags,
                    'raw_tags': tags_str,
                    'definitions': [{'text': f"动词{'（' + type_full + '）' if verb_type else ''}"}]
                }
            else:
                # 如果不是原形，尝试找到对应的原形词条
                # 如果原形不存在，仍然保存（可能是特殊变位）
                if key not in words:
                    type_full = {'transitive': '及物动词', 'intransitive': '不及物动词', 
                                'reflexive': '代动词', 'auxiliary': '助动词', 
                                'impersonal': '无人称动词'}.get(verb_type, '动词')
                    
                    words[key] = {
                        'word': form,
                        'pos': [{'abbr': 'v.', 'full': type_full}],
                        'verb_type': verb_type,
                        'conjugation': ', '.join(conjugation_desc) if conjugation_desc else None,
                        'conjugation_info': conjugation_desc if conjugation_desc else None,
                        'tags': tags,
                        'raw_tags': tags_str,
                        'definitions': [{'text': f"动词{'（' + type_full + '）' if verb_type else ''}"}]
                    }
    
    return list(words.values())

def process_other_pos_csv(csv_path, pos_name):
    """处理其他词性CSV"""
    pos_info = POS_INFO.get(pos_name, {'abbr': pos_name, 'full': pos_name})
    words = {}
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            form = row.get('form', '').strip()
            tags_str = row.get('tags', '').strip()
            if not form:
                continue
            
            tags = parse_tags(tags_str)
            key = form.lower()
            
            if key not in words or (is_base_form(tags) and not is_base_form(parse_tags(words[key].get('raw_tags', '')))):
                words[key] = {
                    'word': form,
                    'pos': [{'abbr': pos_info['abbr'], 'full': pos_info['full']}],
                    'tags': tags,
                    'raw_tags': tags_str,
                    'definitions': [{'text': pos_info['full']}]
                }
    
    return list(words.values())

def merge_words(all_words):
    """合并相同单词的不同词性"""
    merged = {}
    for word_obj in all_words:
        word_key = word_obj['word'].lower()
        if word_key not in merged:
            merged[word_key] = word_obj.copy()
        else:
            # 合并词性
            existing_pos = {p['abbr'] for p in merged[word_key].get('pos', [])}
            new_pos = [p for p in word_obj.get('pos', []) if p['abbr'] not in existing_pos]
            if new_pos:
                merged[word_key]['pos'].extend(new_pos)
            
            # 合并定义
            existing_defs = {d.get('text', '') for d in merged[word_key].get('definitions', [])}
            new_defs = [d for d in word_obj.get('definitions', []) if d.get('text', '') not in existing_defs]
            if new_defs:
                merged[word_key]['definitions'].extend(new_defs)
            
            # 保留其他重要信息（如动词的变位信息）
            if 'conjugation' in word_obj:
                merged[word_key]['conjugation'] = word_obj['conjugation']
            if 'verb_type' in word_obj:
                merged[word_key]['verb_type'] = word_obj['verb_type']
            if 'conjugation_info' in word_obj and word_obj['conjugation_info']:
                merged[word_key]['conjugation_info'] = word_obj['conjugation_info']
    
    return list(merged.values())

def find_dict_source_dir():
    """智能检测词典目录路径"""
    possible_paths = [
        BASE_DIR / 'French-Dictionary' / 'dictionary',  # 项目内
        BASE_DIR.parent / 'French-Dictionary' / 'dictionary',  # 项目同级
        BASE_DIR / 'dictionary',  # 项目根目录
    ]
    
    for path in possible_paths:
        if path.exists():
            return path
    
    return None

def validate_words(words, pos_name):
    """验证词条数据"""
    valid_words = []
    errors = []
    
    for word in words:
        if not word.get('word'):
            errors.append(f"发现空词条，已跳过")
            continue
        
        # 确保必要字段存在
        if 'pos' not in word or not word['pos']:
            word['pos'] = [{'abbr': POS_INFO[pos_name]['abbr'], 'full': POS_INFO[pos_name]['full']}]
        
        if 'definitions' not in word or not word['definitions']:
            word['definitions'] = [{'text': POS_INFO[pos_name]['full']}]
        
        valid_words.append(word)
    
    if errors:
        print(f"  [WARNING] 警告: {len(errors)} 个数据问题")
    
    return valid_words

def main():
    """主函数：分别生成各词性的JSON文件"""
    import datetime
    
    print("=" * 60)
    print("French-Dictionary Import Tool")
    print("分别生成各词性的JSON文件")
    print("=" * 60)
    print()
    
    # 智能检测词典目录
    dict_source_dir = find_dict_source_dir()
    if not dict_source_dir:
        print("错误: 找不到词典目录")
        print("已检查以下路径:")
        print("  1. French-Dictionary/dictionary/ (项目内)")
        print("  2. ../French-Dictionary/dictionary/ (项目同级)")
        print("  3. dictionary/ (项目根目录)")
        print()
        print("请运行: git clone https://github.com/hbenbel/French-Dictionary.git")
        return
    
    print(f"[OK] 找到词典目录: {dict_source_dir}")
    print()
    
    # 确保输出目录存在
    DICT_DIR.mkdir(parents=True, exist_ok=True)
    
    # 处理每个CSV文件
    files_to_process = {
        'noun.csv': ('noun', process_noun_csv),
        'verb.csv': ('verb', process_verb_csv),
        'adj.csv': ('adj', lambda p: process_other_pos_csv(p, 'adj')),
        'adv.csv': ('adv', lambda p: process_other_pos_csv(p, 'adv')),
        'conj.csv': ('conj', lambda p: process_other_pos_csv(p, 'conj')),
        'prep.csv': ('prep', lambda p: process_other_pos_csv(p, 'prep')),
        'pron.csv': ('pron', lambda p: process_other_pos_csv(p, 'pron')),
        'det.csv': ('det', lambda p: process_other_pos_csv(p, 'det'))
    }
    
    pos_counts = {}
    total_count = 0
    generated_files = []
    start_time = datetime.datetime.now()
    
    print("正在处理CSV文件...")
    print()
    
    for filename, (pos_name, processor) in files_to_process.items():
        csv_path = dict_source_dir / filename
        
        if not csv_path.exists():
            print(f"跳过: {filename} (文件不存在)")
            continue
        
        try:
            print(f"处理: {filename} ({POS_INFO[pos_name]['full']})...")
            
            # 处理CSV
            words = processor(csv_path)
            
            # 验证数据
            words = validate_words(words, pos_name)
            
            # 按字母顺序排序
            words.sort(key=lambda x: x['word'].lower())
            
            pos_counts[pos_name] = len(words)
            total_count += len(words)
            
            # 生成JSON文件
            output_file = DICT_DIR / f'{pos_name}.json'
            output_data = {
                'name': f'French Dictionary - {POS_INFO[pos_name]["full"]}',
                'pos': pos_name,
                'count': len(words),
                'source': 'https://github.com/hbenbel/French-Dictionary',
                'license': 'MIT License',
                'copyright': 'Copyright (c) 2021 Hussem Ben Belgacem',
                'version': '1.0.0',
                'generated_at': datetime.datetime.now().isoformat() + 'Z',
                'words': words
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            
            generated_files.append(output_file.name)
            print(f"  [OK] 提取了 {len(words)} 个词条")
            print(f"  [OK] 已保存: {output_file.name}")
            print()
            
        except Exception as e:
            print(f"  [ERROR] 处理失败: {str(e)}")
            import traceback
            traceback.print_exc()
            print()
            continue
    
    elapsed_time = (datetime.datetime.now() - start_time).total_seconds()
    
    print("=" * 60)
    if generated_files:
        print("[SUCCESS] 成功生成所有词典文件")
        print(f"  总词条数: {total_count:,}")
        print(f"  各词性统计:")
        for pos, count in sorted(pos_counts.items()):
            print(f"    - {POS_INFO[pos]['full']}: {count:,}")
        print(f"  生成文件数: {len(generated_files)}")
        print(f"  处理时间: {elapsed_time:.2f} 秒")
    else:
        print("[ERROR] 未能生成任何文件")
    print("=" * 60)

if __name__ == '__main__':
    main()
