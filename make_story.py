#!/usr/bin/env python3

from lxml import html
import argparse

def main():
    p = argparse.ArgumentParser()
    p.add_argument('input')
    p.add_argument('template')
    p.add_argument('output')


    args = p.parse_args()

    story_data_file = args.input
    tree = html.parse(story_data_file)
    storydata_el = tree.find('.//tw-storydata')

    passage_datas = storydata_el.findall('tw-passagedata')

    # for passage_data in passage_datas:
        # if '<div>' in (passage_data.text or ''):
            # print(f'Patching passage: {passage_data.attrib["name"]}')
    #         passage_data.text = (passage_data.text
    #             .replace('<div>', '<div class="part-left">', 1)
    #             .replace('<div>', '<div class="part-right">', 1)
    #         )
    # # tree.write('GR 05_06.fixed.html')
    story_data_html = html.tostring(storydata_el).decode()

    with open(args.template) as f:
        tpl = f.read()

    with open(args.output, 'w') as f:
        f.write(tpl.replace('{{TW_STORY_DATA}}', story_data_html))


if __name__ == '__main__':
    main()


