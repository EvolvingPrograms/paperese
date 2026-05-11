---
title: A Two Column Arxiv Template
short_title: A Two Column Arxiv Template
description: A two column template suitable for arxiv preprint submissions, ported to paperese.
authors:
  - name: Brenhin Keller
    affiliation: Dartmouth College
    email: bkeller@university.edu
    is_corresponding: true
keywords: [keyword1, keyword2, keyword3]
abstract: >
  Morbi eu neque et enim euismod cursus sit amet sit amet elit: Fusce eget
  neque placerat, vehicula dui id, placerat velit. Proin pellentesque
  fermentum sollicitudin. Etiam egestas sed dolor rutrum faucibus. Nunc ac
  viverra justo. Vestibulum eget erat pretium sem blandit placerat
  ullamcorper nec velit. Aliquam orci enim, luctus tempor euismod a,
  aliquam in ex. Morbi ultrices sapien quis neque sagittis condimentum.
references:
  - id: kour2014real
    type: inproceedings
    title: Real-time segmentation of on-line handwritten arabic script
    author: Kour, George and Saabne, Raid
    booktitle: Frontiers in Handwriting Recognition (ICFHR), 2014 14th International Conference on
    pages: 417--422
    year: 2014
    organization: IEEE
  - id: kour2014fast
    type: inproceedings
    title: Fast classification of handwritten on-line Arabic characters
    author: Kour, George and Saabne, Raid
    booktitle: Soft Computing and Pattern Recognition (SoCPaR), 2014 6th International Conference of
    pages: 312--318
    year: 2014
    organization: IEEE
  - id: hadash2018estimate
    type: article
    title: "Estimate and Replace: A Novel Approach to Integrating Deep Neural Networks with Existing Applications"
    author: Hadash, Guy and Kermany, Einat and Carmeli, Boaz and Lavi, Ofer and Kour, George and Jacovi, Alon
    journal: arXiv preprint arXiv:1804.09028
    year: 2018
output: paper.tex
---

# Introduction

\lipsum[2]

\lipsum[3]

# Headings: first level {#sec:headings}

\lipsum[7] See Section \ref{sec:headings}.

## Headings: second level

\lipsum[5]

$$
\xi_{ij}(t) = \frac{\alpha_i(t) a^{w_t}_{ij} \beta_j(t+1) b^{v_{t+1}}_j(y_{t+1})}{\sum_{i=1}^{N} \sum_{j=1}^{N} \alpha_i(t) a^{w_t}_{ij} \beta_j(t+1) b^{v_{t+1}}_j(y_{t+1})}
$$

### Headings: third level

\lipsum[6]

\paragraph{Paragraph}
\lipsum[7]

# Examples of citations, figures, tables, references {#sec:others}

\lipsum[8]

[@kour2014real; @kour2014fast] and see [@hadash2018estimate].

The documentation for `natbib` may be found at
<http://mirrors.ctan.org/macros/latex/contrib/natbib/natnotes.pdf>.

## Figures

\lipsum[10]

See Figure \ref{fig:fig1}.

\lipsum[11]

![Sample figure caption.\label{fig:fig1}](placeholder.png){width=4cm}

## Lists

- Lorem ipsum dolor sit amet
- consectetur adipiscing elit
- Aliquam dignissim blandit est, in dictum tortor gravida eget.

## Tables

See Table \ref{tab:results} for a markdown table rendering test.

| Method   | Accuracy | F1 Score | Notes                  |
|----------|---------:|---------:|------------------------|
| Baseline |    0.812 |    0.798 | Vanilla logistic regr. |
| Ours     |    0.904 |    0.891 | Proposed approach      |
| Ours+aug |    0.921 |    0.910 | With augmentation      |

: Results comparison across methods.\label{tab:results}
